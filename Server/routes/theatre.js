const express = require('express');
const { db } = require('../firebase-config');
const { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, getDocs, runTransaction } = require("firebase-admin/firestore");

const router = express.Router();

// ✅ **Create Theatre with auto-generated ID**
router.post('/', async (req, res) => {
    const { Rows, Columns } = req.body; // Remove Capacity from destructuring

    // Validate required fields
    if (!Rows || !Columns) {
        return res.status(400).json({ 
            error: "Missing required fields: Rows, Columns" 
        });
    }

    // Validate data types
    if (typeof Rows !== 'number' || typeof Columns !== 'number') {
        return res.status(400).json({ 
            error: "Invalid data types: Rows, Columns must be numbers" 
        });
    }

    // Auto-calculate capacity
    const Capacity = Rows * Columns;

    try {
        const counterRef = db.collection('counters').doc('Theatre'); // Counter for Theatre IDs
        let newCount;

        // Atomic transaction to increment counter
        await db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            newCount = (counterDoc.exists ? counterDoc.data().count : 0) + 1;
            transaction.set(counterRef, { count: newCount }, { merge: true });
        });

        // Generate new TheatreID
        const newTheatreID = `Theatre${newCount}`;

        // Create the new theatre document
        await db.collection("Theatre").doc(newTheatreID).set({
            Capacity, // Use calculated capacity
            Rows,
            Columns
        });

        res.status(200).json({ 
            message: "Theatre created successfully",
            generatedId: newTheatreID 
        });
    } catch (error) {
        res.status(500).json({ error: "Error creating theatre: " + error.message });
    }
});

// ✅ **Get All Theatres**
router.get('/', async (req, res) => {
    try {
        const theatresSnapshot = await db.collection("Theatre").get();
        const theatres = theatresSnapshot.docs.map(doc => ({
            TheatreID: doc.id, // Map document ID to TheatreID
            Capacity: doc.data().Capacity,
            Rows: doc.data().Rows,
            Columns: doc.data().Columns
        }));
        res.status(200).json(theatres);
    } catch (error) {
        res.status(500).json({ error: "Error fetching theatres: " + error.message });
    }
});

// ✅ **Get Single Theatre by ID**
router.get('/:theatreID', async (req, res) => {
    const { theatreID } = req.params;

    // Validate theatreID format (optional)
    if (!theatreID.startsWith("Theatre")) {
        return res.status(400).json({ error: "Invalid TheatreID format" });
    }

    try {
        const theatreRef = db.collection("Theatre").doc(theatreID);
        const theatreDoc = await theatreRef.get();
        if (!theatreDoc.exists) {
            return res.status(404).json({ message: "Theatre not found" });
        }
        
        res.status(200).json({
            TheatreID: theatreID, // Include document ID as TheatreID
            Capacity: theatreDoc.data().Capacity,
            Rows: theatreDoc.data().Rows,
            Columns: theatreDoc.data().Columns
        });
    } catch (error) {
        res.status(500).json({ error: "Error fetching theatre: " + error.message });
    }
});

// ✅ **Update Theatre**
router.put('/:theatreID', async (req, res) => {
    const { theatreID } = req.params;
    const { Capacity, Rows, Columns } = req.body;

    // Validate at least one field is provided
    if (!Capacity && !Rows && !Columns) {
        return res.status(400).json({ 
            error: "At least one field is required for update: Capacity, Rows, Columns" 
        });
    }

    // Validate data types (if fields are provided)
    if (Capacity && typeof Capacity !== 'number') {
        return res.status(400).json({ error: "Capacity must be a number" });
    }
    if (Rows && typeof Rows !== 'number') {
        return res.status(400).json({ error: "Rows must be a number" });
    }
    if (Columns && typeof Columns !== 'number') {
        return res.status(400).json({ error: "Columns must be a number" });
    }

    try {
        const theatreRef = db.collection("Theatre").doc(theatreID);

        // Check if theatre exists
        const theatreDoc = await theatreRef.get();
        if (!theatreDoc.exists) {
            return res.status(404).json({ message: "Theatre not found" });
        }

        // Prepare update data
        const updateData = {};
        if (Capacity !== undefined) updateData.Capacity = Capacity;
        if (Rows !== undefined) updateData.Rows = Rows;
        if (Columns !== undefined) updateData.Columns = Columns;

        // Update the theatre document
        await theatreRef.update(updateData);
        res.status(200).json({ message: "Theatre updated successfully." });
    } catch (error) {
        res.status(500).json({ error: "Error updating theatre: " + error.message });
    }
});

// ✅ **Delete Theatre**
router.delete('/:theatreID', async (req, res) => {
    const { theatreID } = req.params;

    // Validate theatreID format (optional)
    if (!theatreID.startsWith("Theatre")) {
        return res.status(400).json({ error: "Invalid TheatreID format" });
    }

    try {
        const theatreRef = db.collection("Theatre").doc(theatreID);

        // Check if theatre exists
        const theatreDoc = await theatreRef.get();
        if (!theatreDoc.exists) {
            return res.status(404).json({ message: "Theatre not found" });
        }

        // Delete the theatre document
        await theatreRef.delete();
        res.status(200).json({ message: "Theatre deleted successfully." });
    } catch (error) {
        res.status(500).json({ error: "Error deleting theatre: " + error.message });
    }
});

module.exports = router;