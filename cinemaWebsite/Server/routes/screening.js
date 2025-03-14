const express = require('express');
const {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  runTransaction,
  query,
  where
} = require("firebase-admin/firestore");
const { db } = require('../firebase-config');

const router = express.Router();

// Helper to convert "HH:MM" to minutes since midnight
function parseTime(timeStr) {
    const parts = timeStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

// ✅ Create Screening with auto-generated ID
router.post('/', async (req, res) => {
    const { FilmID, TheatreID, Date, StartTime } = req.body;

    // Validate required fields
    if (!FilmID || !TheatreID || !Date || !StartTime) {
        return res.status(400).json({
            error: "Missing required fields: FilmID, TheatreID, Date, StartTime"
        });
    }

    // Validate data types
    if (typeof FilmID !== 'string' || typeof TheatreID !== 'string' || 
        typeof Date !== 'string' || typeof StartTime !== 'string') {
        return res.status(400).json({
            error: "Invalid data types: FilmID, TheatreID, Date, StartTime must be strings"
        });
    }

    try {
        // Check if Film exists
        const filmRef = db.collection("Film").doc(FilmID);
        const filmDoc = await filmRef.get();
        if (!filmDoc.exists) {
            return res.status(404).json({ error: `FilmID ${FilmID} not found` });
        }

        // Check if Theatre exists and get capacity
        const theatreRef = db.collection("Theatre").doc(TheatreID);
        const theatreDoc = await theatreRef.get();
        if (!theatreDoc.exists) {
            return res.status(404).json({ error: `TheatreID ${TheatreID} not found` });
        }
        const theatreCapacity = theatreDoc.data().Capacity;

        // Check for overlapping screenings
        const screeningsSnapshot = await db.collection("Screening")
            .where("TheatreID", "==", theatreRef)
            .where("Date", "==", Date)
            .get();
        
        const newStart = parseTime(StartTime);
        const filmDuration = filmDoc.data().Duration;
        const newBlock = filmDuration + 60;
        const newEnd = newStart + newBlock;

        for (const doc of screeningsSnapshot.docs) {
            const existingData = doc.data();
            const existingFilmDoc = await existingData.FilmID.get();
            const existingDuration = existingFilmDoc.data().Duration;
            const existingBlock = existingDuration + 60;
            const existStart = parseTime(existingData.StartTime);
            const existEnd = existStart + existingBlock;
            
            if (newStart < existEnd && existStart < newEnd) {
                return res.status(400).json({
                    error: `A screening is scheduled in ${TheatreID} for this time.`
                });
            }
        }

        // Generate ScreeningID
        const counterRef = db.collection('counters').doc('Screening');
        let newCount;

        await db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            newCount = (counterDoc.exists ? counterDoc.data().count : 0) + 1;
            transaction.set(counterRef, { count: newCount }, { merge: true });
        });

        const newScreeningID = `Screening${newCount}`;

        // Create screening with theatre capacity
        await db.collection("Screening").doc(newScreeningID).set({
            FilmID: filmRef,
            TheatreID: theatreRef,
            Date,
            StartTime,
            SeatsRemaining: theatreCapacity // Auto-set from theatre
        });

        res.status(200).json({
            message: "Screening created successfully",
            generatedId: newScreeningID
        });
    } catch (error) {
        res.status(500).json({ error: "Error creating screening: " + error.message });
    }
});

// ✅ Update Screening
router.put('/:screeningID', async (req, res) => {
    const { screeningID } = req.params;
    const { FilmID, TheatreID, Date, StartTime } = req.body;

    if (!FilmID && !TheatreID && !Date && !StartTime) {
        return res.status(400).json({
            error: "At least one field is required for update: FilmID, TheatreID, Date, StartTime"
        });
    }

    try {
        const screeningRef = db.collection("Screening").doc(screeningID);
        const screeningDoc = await screeningRef.get();

        if (!screeningDoc.exists) {
            return res.status(404).json({ message: "Screening not found" });
        }

        const currentData = screeningDoc.data();
        const updateData = {};

        // Handle TheatreID change
        if (TheatreID) {
            const theatreRef = db.collection("Theatre").doc(TheatreID);
            const theatreDoc = await theatreRef.get();
            if (!theatreDoc.exists) {
                return res.status(404).json({ error: `TheatreID ${TheatreID} not found` });
            }

            // Recalculate seats if theatre changes
            const ticketsSnapshot = await db.collection("Ticket")
                .where("ScreeningID", "==", screeningRef)
                .get();
            
            updateData.TheatreID = theatreRef;
            updateData.SeatsRemaining = theatreDoc.data().Capacity - ticketsSnapshot.size;
        }

        // Handle other fields
        if (FilmID) {
            const filmRef = db.collection("Film").doc(FilmID);
            const filmDoc = await filmRef.get();
            if (!filmDoc.exists) {
                return res.status(404).json({ error: `FilmID ${FilmID} not found` });
            }
            updateData.FilmID = filmRef;
        }

        if (Date) updateData.Date = Date;
        if (StartTime) updateData.StartTime = StartTime;

        // Check for time conflicts if time/date/theatre changes
        if (Date || StartTime || TheatreID) {
            const newTheatreRef = TheatreID ? 
                db.collection("Theatre").doc(TheatreID) : 
                currentData.TheatreID;
            
            const newDate = Date || currentData.Date;
            const newStartTime = StartTime || currentData.StartTime;
            
            const filmRef = FilmID ? 
                db.collection("Film").doc(FilmID) : 
                currentData.FilmID;
            
            const filmDoc = await filmRef.get();
            const filmDuration = filmDoc.data().Duration;
            
            const screeningsSnapshot = await db.collection("Screening")
                .where("TheatreID", "==", newTheatreRef)
                .where("Date", "==", newDate)
                .get();

            const newStart = parseTime(newStartTime);
            const newEnd = newStart + filmDuration + 60;

            for (const doc of screeningsSnapshot.docs) {
                if (doc.id === screeningID) continue;
                
                const existingData = doc.data();
                const existFilmDoc = await existingData.FilmID.get();
                const existDuration = existFilmDoc.data().Duration;
                const existStart = parseTime(existingData.StartTime);
                const existEnd = existStart + existDuration + 60;

                if (newStart < existEnd && existStart < newEnd) {
                    return res.status(400).json({
                        error: `A screening is scheduled in this theatre at a conflicting time.`
                    });
                }
            }
        }

        await screeningRef.update(updateData);
        res.status(200).json({ message: "Screening updated successfully." });
    } catch (error) {
        res.status(500).json({ error: "Error updating screening: " + error.message });
    }
});

// ✅ Dedicated Endpoint: Get Screenings by FilmID
router.get('/byFilm/:filmID', async (req, res) => {
    const { filmID } = req.params;
    console.log("Fetching screenings for Film Document ID:", filmID); // ✅ Debugging
 
    try {
        const filmRef = db.collection("Film").doc(filmID); // ✅ Correct reference
        const screeningsSnapshot = await db.collection("Screening").where("FilmID", "==", filmRef).get();
 
        if (screeningsSnapshot.empty) {
            console.log("No screenings found for:", filmID);
            return res.status(200).json([]); // ✅ Return empty array if no screenings
        }
 
        const screenings = screeningsSnapshot.docs.map(doc => ({
            ScreeningID: doc.id,
            ...doc.data()
        }));
 
        console.log("Returning screenings:", screenings); // ✅ Debugging
        res.status(200).json(screenings);
    } catch (error) {
        console.error("Error fetching screenings:", error);
        res.status(500).json({ error: "Failed to fetch screenings" });
    }
});
 
 
// ✅ Get Single Screening by ID
router.get('/:screeningID', async (req, res) => {
    const { screeningID } = req.params;
    if (!screeningID.startsWith("Screening")) {
        return res.status(400).json({ error: "Invalid ScreeningID format" });
    }
    try {
        const screeningRef = db.collection("Screening").doc(screeningID);
        const screeningDoc = await screeningRef.get();
        if (!screeningDoc.exists) {
            return res.status(404).json({ message: "Screening not found" });
        }
        const data = screeningDoc.data();
        res.status(200).json({
            ScreeningID: screeningID,
            FilmID: data.FilmID.id,
            TheatreID: data.TheatreID.id,
            Date: data.Date,
            StartTime: data.StartTime,
            SeatsRemaining: data.SeatsRemaining
        });
    } catch (error) {
        res.status(500).json({ error: "Error fetching screening: " + error.message });
    }
});
 
router.get('/', async (req, res) => {
    try {
        const screeningsSnapshot = await db.collection("Screening").get();
        const screenings = screeningsSnapshot.docs.map(doc => {
            const data = doc.data();
 
            return {
                ScreeningID: doc.id,
                FilmID: data.FilmID.id,  // ✅ Convert Firestore reference to string
                TheatreID: data.TheatreID.id, // ✅ Convert Firestore reference to string
                Date: data.Date,
                StartTime: data.StartTime,
                SeatsRemaining: data.SeatsRemaining
            };
        });
 
        res.status(200).json(screenings);
    } catch (error) {
        res.status(500).json({ error: "Error fetching screenings: " + error.message });
    }
});

// ✅ Delete Screening
router.delete('/:screeningID', async (req, res) => {
    const { screeningID } = req.params;
    if (!screeningID.startsWith("Screening")) {
        return res.status(400).json({ error: "Invalid ScreeningID format" });
    }
    try {
        const screeningRef = db.collection("Screening").doc(screeningID);
        const screeningDoc = await screeningRef.get();
        if (!screeningDoc.exists) {
            return res.status(404).json({ message: "Screening not found" });
        }
        await screeningRef.delete();
        res.status(200).json({ message: "Screening deleted successfully." });
    } catch (error) {
        res.status(500).json({ error: "Error deleting screening: " + error.message });
    }
});
 
module.exports = router;