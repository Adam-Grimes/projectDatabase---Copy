const express = require('express');
const { db } = require('../firebase-config');
const { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, getDocs, runTransaction } = require("firebase-admin/firestore");

const router = express.Router();

// ✅ **Create Ticket with auto-generated ID**
router.post('/', async (req, res) => {
    const { BookingID, ScreeningID, SeatRow, SeatColumn } = req.body;

    try {
        // Validate required fields
        if (!BookingID || !ScreeningID || SeatRow === undefined || SeatColumn === undefined) {
            return res.status(400).json({ 
                error: "Missing required fields: BookingID, ScreeningID, SeatRow, SeatColumn" 
            });
        }

        // Get Firestore references
        const bookingRef = db.collection("Booking").doc(BookingID);
        const screeningRef = db.collection("Screening").doc(ScreeningID);
        const ticketTypeRef = db.collection("TicketType").doc("Adult"); // Hardcoded to "Adult"

        let newTicketID;

        await db.runTransaction(async (transaction) => {
            // 1. Perform all reads first
            const [bookingDoc, screeningDoc, ticketTypeDoc, counterDoc] = await Promise.all([
                transaction.get(bookingRef),
                transaction.get(screeningRef),
                transaction.get(ticketTypeRef),
                transaction.get(db.collection('counters').doc('Ticket')) // Read counter
            ]);

            // 2. Validate documents exist
            if (!bookingDoc.exists) throw new Error(`BookingID ${BookingID} not found`);
            if (!screeningDoc.exists) throw new Error(`ScreeningID ${ScreeningID} not found`);
            if (!ticketTypeDoc.exists) throw new Error(`TicketType "Adult" not found`);

            // 3. Check seats remaining
            const seatsRemaining = screeningDoc.data().SeatsRemaining;
            if (seatsRemaining <= 0) throw new Error("No seats available");

            // 4. Generate TicketID
            const newCount = (counterDoc.exists ? counterDoc.data().count : 0) + 1;
            newTicketID = `Ticket${newCount}`;

            // 5. Perform all writes
            transaction.update(screeningRef, { SeatsRemaining: seatsRemaining - 1 }); // Decrement seats
            transaction.set(db.collection('counters').doc('Ticket'), { count: newCount }); // Update counter
            transaction.set(db.collection("Ticket").doc(newTicketID), {
                BookingID: bookingRef,
                ScreeningID: screeningRef,
                TicketType: ticketTypeRef, // Use the reference
                SeatRow: SeatRow,
                SeatColumn: SeatColumn
            });
        });

        res.status(200).json({ 
            message: "Ticket created successfully",
            generatedId: newTicketID 
        });
    } catch (error) {
        console.error("Ticket creation error:", error.message); // Log the error
        res.status(500).json({ error: error.message }); // Return detailed error
    }
});



// ✅ Get Single Ticket by ID
router.get('/:ticketID', async (req, res) => {
    const { ticketID } = req.params;
    
    try {
        const ticketRef = db.collection("Ticket").doc(ticketID);
        const ticketDoc = await ticketRef.get();

        if (!ticketDoc.exists) {
            return res.status(404).json({ message: "Ticket not found" });
        }

        const ticketData = ticketDoc.data();
        
        // Resolve document references to IDs
        const resolveRef = async (ref) => (await ref.get()).id;

        const response = {
            TicketID: ticketID,
            BookingID: await resolveRef(ticketData.BookingID),
            ScreeningID: await resolveRef(ticketData.ScreeningID),
            TicketType: await resolveRef(ticketData.TicketType),
            SeatRow: ticketData.SeatRow,
            SeatColumn: ticketData.SeatColumn
        };

        res.status(200).json(response);
    } catch (error) {
        console.error("Error fetching ticket:", error);
        res.status(500).json({ error: "Error fetching ticket: " + error.message });
    }
});

// ✅ Get All Tickets
// ✅ Get All Tickets (with optional ScreeningID filter)
router.get('/', async (req, res) => {
    try {
        let query = db.collection("Ticket");
        
        // Add ScreeningID filter if provided in query params
        if (req.query.ScreeningID) {
            const screeningRef = db.collection("Screening").doc(req.query.ScreeningID);
            query = query.where("ScreeningID", "==", screeningRef);
        }

        const ticketsSnapshot = await query.get();
        const tickets = await Promise.all(ticketsSnapshot.docs.map(async (doc) => {
            const ticketData = doc.data();
            
            const resolveRef = async (ref) => (await ref.get()).id;

            return {
                TicketID: doc.id,
                BookingID: await resolveRef(ticketData.BookingID),
                ScreeningID: await resolveRef(ticketData.ScreeningID),
                TicketType: await resolveRef(ticketData.TicketType),
                SeatRow: ticketData.SeatRow,
                SeatColumn: ticketData.SeatColumn
            };
        }));

        res.status(200).json(tickets);
    } catch (error) {
        console.error("Error fetching tickets:", error);
        res.status(500).json({ error: "Error fetching tickets: " + error.message });
    }
});
// ✅ Update Ticket
router.put('/:ticketID', async (req, res) => {
    const { ticketID } = req.params;
    const { BookingID, ScreeningID, TicketType, SeatRow, SeatColumn } = req.body;

    try {
        await db.runTransaction(async (transaction) => {
            // 1. Get ticket reference
            const ticketRef = db.collection("Ticket").doc(ticketID);
            const ticketDoc = await transaction.get(ticketRef);
            
            if (!ticketDoc.exists) {
                throw new Error("Ticket not found");
            }

            // 2. Initialize update data
            const updateData = {};
            const currentData = ticketDoc.data();

            // 3. Handle ScreeningID change
            if (ScreeningID && ScreeningID !== currentData.ScreeningID.id) {
                const oldScreeningRef = currentData.ScreeningID;
                const newScreeningRef = db.collection("Screening").doc(ScreeningID);

                // Verify new screening exists and get seats
                const [oldScreeningDoc, newScreeningDoc] = await Promise.all([
                    transaction.get(oldScreeningRef),
                    transaction.get(newScreeningRef)
                ]);

                if (!newScreeningDoc.exists) throw new Error("New ScreeningID not found");
                if (newScreeningDoc.data().SeatsRemaining <= 0) throw new Error("No seats available in new screening");

                // Update seat counts
                transaction.update(oldScreeningRef, {
                    SeatsRemaining: oldScreeningDoc.data().SeatsRemaining + 1
                });
                transaction.update(newScreeningRef, {
                    SeatsRemaining: newScreeningDoc.data().SeatsRemaining - 1
                });

                updateData.ScreeningID = newScreeningRef;
            }

            // 4. Handle BookingID change
            if (BookingID && BookingID !== currentData.BookingID.id) {
                const bookingRef = db.collection("Booking").doc(BookingID);
                const bookingDoc = await transaction.get(bookingRef);
                if (!bookingDoc.exists) throw new Error("BookingID not found");
                updateData.BookingID = bookingRef;
            }

            // 5. Handle TicketType change
            if (TicketType && TicketType !== currentData.TicketType.id) {
                const ticketTypeRef = db.collection("TicketType").doc(TicketType);
                const ticketTypeDoc = await transaction.get(ticketTypeRef);
                if (!ticketTypeDoc.exists) throw new Error("TicketType not found");
                updateData.TicketType = ticketTypeRef;
            }

            // 6. Update other fields
            if (SeatRow !== undefined) updateData.SeatRow = SeatRow;
            if (SeatColumn !== undefined) updateData.SeatColumn = SeatColumn;

            // 7. Perform update
            if (Object.keys(updateData).length > 0) {
                transaction.update(ticketRef, updateData);
            }
        });

        res.status(200).json({ message: "Ticket updated successfully" });
    } catch (error) {
        console.error("Error updating ticket:", error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Delete Ticket
router.delete('/:ticketID', async (req, res) => {
    const { ticketID } = req.params;
    
    try {
        await db.runTransaction(async (transaction) => {
            // 1. Get ticket and screening reference
            const ticketRef = db.collection("Ticket").doc(ticketID);
            const ticketDoc = await transaction.get(ticketRef);
            
            if (!ticketDoc.exists) {
                throw new Error("Ticket not found");
            }

            // 2. Restore seat in screening
            const screeningRef = ticketDoc.data().ScreeningID;
            const screeningDoc = await transaction.get(screeningRef);
            
            if (screeningDoc.exists) {
                transaction.update(screeningRef, {
                    SeatsRemaining: screeningDoc.data().SeatsRemaining + 1
                });
            }

            // 3. Delete ticket
            transaction.delete(ticketRef);
        });

        res.status(200).json({ message: "Ticket deleted successfully" });
    } catch (error) {
        console.error("Error deleting ticket:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;