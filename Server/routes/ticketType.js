const express = require('express');
const { db } = require('../firebase-config');
const { doc, getDoc, updateDoc, deleteDoc, getDocs, setDoc } = require("firebase-admin/firestore");

const router = express.Router();

// ✅ **Create TicketType** (Document ID = TicketTypeID)
router.post('/', async (req, res) => {
    const { TicketTypeID, Cost } = req.body;

    // Validate required fields
    if (!TicketTypeID || Cost === undefined) {
        return res.status(400).json({ 
            error: "Missing required fields: TicketTypeID, Cost" 
        });
    }

    // Validate data types
    if (typeof TicketTypeID !== 'string' || typeof Cost !== 'number') {
        return res.status(400).json({ 
            error: "Invalid data types: TicketTypeID must be a string, Cost must be a number" 
        });
    }

    try {
        // Check if TicketTypeID already exists
        const ticketTypeRef = db.collection("TicketType").doc(TicketTypeID);
        const ticketTypeDoc = await ticketTypeRef.get();
        if (ticketTypeDoc.exists) {
            return res.status(400).json({ error: `TicketTypeID '${TicketTypeID}' already exists` });
        }

        // Create the ticket type document
        await ticketTypeRef.set({ Cost: Cost });
        res.status(200).json({ 
            message: "Ticket type created successfully",
            TicketTypeID: TicketTypeID 
        });
    } catch (error) {
        res.status(500).json({ error: "Error creating ticket type: " + error.message });
    }
});

// ✅ **Get Single TicketType by ID**
router.get('/:ticketTypeID', async (req, res) => {
    const { ticketTypeID } = req.params;

    // Validate TicketTypeID format (optional)
    if (typeof ticketTypeID !== 'string') {
        return res.status(400).json({ error: "Invalid TicketTypeID format" });
    }

    try {
        const ticketTypeRef = db.collection("TicketType").doc(ticketTypeID);
        const ticketTypeDoc = await ticketTypeRef.get();
        if (!ticketTypeDoc.exists) {
            return res.status(404).json({ message: "Ticket type not found" });
        }
        
        res.status(200).json({
            TicketTypeID: ticketTypeID,
            Cost: ticketTypeDoc.data().Cost
        });
    } catch (error) {
        res.status(500).json({ error: "Error fetching ticket type: " + error.message });
    }
});

// ✅ **Get All TicketTypes**
router.get('/', async (req, res) => {
    try {
        const ticketTypesSnapshot = await db.collection("TicketType").get();
        const ticketTypes = ticketTypesSnapshot.docs.map(doc => ({
            TicketTypeID: doc.id, // Document ID is the identifier (e.g., "Adult")
            Cost: doc.data().Cost
        }));
        res.status(200).json(ticketTypes);
    } catch (error) {
        res.status(500).json({ error: "Error fetching ticket types: " + error.message });
    }
});



// ✅ **Update TicketType** (Only Cost can be updated)
router.put('/:ticketTypeID', async (req, res) => {
    const { ticketTypeID } = req.params;
    const { Cost } = req.body;

    // Validate required field
    if (Cost === undefined) {
        return res.status(400).json({ error: "Missing required field: Cost" });
    }

    // Validate data type
    if (typeof Cost !== 'number') {
        return res.status(400).json({ error: "Invalid data type: Cost must be a number" });
    }

    try {
        const ticketTypeRef = db.collection("TicketType").doc(ticketTypeID);
        
        // Check if ticket type exists
        const ticketTypeDoc = await ticketTypeRef.get();
        if (!ticketTypeDoc.exists) {
            return res.status(404).json({ message: "Ticket type not found" });
        }

        // Update the ticket type
        await ticketTypeRef.update({ Cost: Cost });
        res.status(200).json({ message: "Ticket type updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error updating ticket type: " + error.message });
    }
});

// ✅ **Delete TicketType**
router.delete('/:ticketTypeID', async (req, res) => {
    const { ticketTypeID } = req.params;

    // Validate TicketTypeID format (optional)
    if (typeof ticketTypeID !== 'string') {
        return res.status(400).json({ error: "Invalid TicketTypeID format" });
    }

    try {
        const ticketTypeRef = db.collection("TicketType").doc(ticketTypeID);
        
        // Check if ticket type exists
        const ticketTypeDoc = await ticketTypeRef.get();
        if (!ticketTypeDoc.exists) {
            return res.status(404).json({ message: "Ticket type not found" });
        }

        // Delete the ticket type
        await ticketTypeRef.delete();
        res.status(200).json({ message: "Ticket type deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error deleting ticket type: " + error.message });
    }
});

module.exports = router;