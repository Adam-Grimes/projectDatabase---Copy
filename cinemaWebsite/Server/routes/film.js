const express = require('express');
const { db } = require('../firebase-config');
const { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, getDocs } = require("firebase-admin/firestore");

const router = express.Router();

// ✅ Create Film
router.post('/', async (req, res) => {
    const { FilmID, Name, Category, Genre, Duration, Trailer, Poster } = req.body;
    if (!FilmID || !Name || !Category || !Genre || !Duration) {
        return res.status(400).json({ error: "Missing required fields: FilmID, Name, Category, Genre, Duration" });
    }
    if (typeof FilmID !== 'string' || typeof Name !== 'string' || typeof Category !== 'string' || 
        typeof Genre !== 'string' || typeof Duration !== 'number') {
        return res.status(400).json({ error: "Invalid data types: FilmID, Name, Category, Genre must be strings; Duration must be a number" });
    }
    try {
        const filmRef = db.collection("Film").doc(FilmID);
        const filmDoc = await filmRef.get();
        if (filmDoc.exists) {
            return res.status(400).json({ error: `FilmID ${FilmID} already exists` });
        }
        await filmRef.set({
            Name,
            Category,
            Genre,
            Duration,
            Trailer: Trailer || null,
            Poster: Poster || null
        });
        res.status(200).json({ message: "Film created successfully", FilmID });
    } catch (error) {
        res.status(500).json({ error: "Error creating film: " + error.message });
    }
});



// ✅ Get Single Film by ID
router.get('/:filmID', async (req, res) => {
    const { filmID } = req.params;
    console.log("Fetching Film with Document ID:", filmID); // ✅ Debugging

    try {
        const filmRef = db.collection("Film").doc(filmID); // ✅ Fetch by document ID
        const filmDoc = await filmRef.get();

        if (!filmDoc.exists) {
            console.error("Film NOT found:", filmID);
            return res.status(404).json({ message: "Film not found" });
        }

        console.log("Returning Film Data:", filmDoc.data()); // ✅ Debugging
        res.status(200).json({ FilmID: filmID, ...filmDoc.data() }); // ✅ Include document ID
    } catch (error) {
        console.error("Error fetching film:", error);
        res.status(500).json({ error: "Error fetching film: " + error.message });
    }
});



router.get('/', async (req, res) => {
    try {
        const filmsSnapshot = await db.collection("Film").get();
        const films = filmsSnapshot.docs.map(doc => ({
            FilmID: doc.id, // ✅ Include document ID
            ...doc.data()
        }));

        res.status(200).json(films);
    } catch (error) {
        res.status(500).json({ error: "Error fetching films: " + error.message });
    }
});


// ✅ Update Film
router.put('/:filmID', async (req, res) => {
    const { filmID } = req.params;
    const { Name, Category, Genre, Duration, Trailer, Poster } = req.body;
    if (!Name && !Category && !Genre && !Duration && !Trailer && !Poster) {
        return res.status(400).json({ error: "At least one field is required for update: Name, Category, Genre, Duration, Trailer, Poster" });
    }
    if (Name && typeof Name !== 'string') {
        return res.status(400).json({ error: "Name must be a string" });
    }
    if (Category && typeof Category !== 'string') {
        return res.status(400).json({ error: "Category must be a string" });
    }
    if (Genre && typeof Genre !== 'string') {
        return res.status(400).json({ error: "Genre must be a string" });
    }
    if (Duration && typeof Duration !== 'number') {
        return res.status(400).json({ error: "Duration must be a number" });
    }
    if (Trailer && typeof Trailer !== 'string') {
        return res.status(400).json({ error: "Trailer must be a string" });
    }
    if (Poster && typeof Poster !== 'string') {
        return res.status(400).json({ error: "Poster must be a string" });
    }
    try {
        const filmRef = db.collection("Film").doc(filmID);
        const filmDoc = await filmRef.get();
        if (!filmDoc.exists) {
            return res.status(404).json({ message: "Film not found" });
        }
        const updateData = {};
        if (Name !== undefined) updateData.Name = Name;
        if (Category !== undefined) updateData.Category = Category;
        if (Genre !== undefined) updateData.Genre = Genre;
        if (Duration !== undefined) updateData.Duration = Duration;
        if (Trailer !== undefined) updateData.Trailer = Trailer;
        if (Poster !== undefined) updateData.Poster = Poster;
        await filmRef.update(updateData);
        res.status(200).json({ message: "Film updated successfully." });
    } catch (error) {
        res.status(500).json({ error: "Error updating film: " + error.message });
    }
});


router.delete('/:filmID', async (req, res) => {
    const { filmID } = req.params;
    console.log("Attempting to delete film with ID:", filmID); // Debugging
 
    // Validate filmID
    if (!filmID || typeof filmID !== 'string') {
        return res.status(400).json({ error: "Invalid FilmID format" });
    }
 
    try {
        const filmRef = db.collection("Film").doc(filmID);
        const filmDoc = await filmRef.get();
 
        // Check if film exists
        if (!filmDoc.exists) {
            console.error("Film not found:", filmID); // Debugging
            return res.status(404).json({ message: "Film not found" });
        }
 
        // Delete the film
        await filmRef.delete();
        console.log("Film deleted successfully:", filmID); // Debugging
        res.status(200).json({ message: "Film deleted successfully." });
    } catch (error) {
        console.error("Error deleting film:", error); // Debugging
        res.status(500).json({ error: "Error deleting film: " + error.message });
    }
});

module.exports = router;
