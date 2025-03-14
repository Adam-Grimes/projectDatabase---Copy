const express = require('express');
const cors = require('cors');
const path = require('path');
const { db } = require('./Server/firebase-config'); // Import the Firestore instance

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'Public')));

// Import routes
const bookingRoutes = require('./Server/routes/booking');
const filmRoutes = require('./Server/routes/film');
const screeningRoutes = require('./Server/routes/screening');
const theatreRoutes = require('./Server/routes/theatre');
const ticketRoutes = require('./Server/routes/ticket');
const ticketTypeRoutes = require('./Server/routes/ticketType');


// Use routes
app.use('/api/Booking', bookingRoutes);
app.use('/api/Film', filmRoutes);
app.use('/api/Screening', screeningRoutes);
app.use('/api/Theatre', theatreRoutes);
app.use('/api/Ticket', ticketRoutes);
app.use('/api/TicketType', ticketTypeRoutes);

// Start server
/* const PORT = process.env.PORT || 3000;
const server = app.listen(Port, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
 */

const server = app.listen(0, () => {
    const assignedPort = server.address().port;
    console.log(`Server running at http://localhost:${assignedPort}/`);
});