document.addEventListener("DOMContentLoaded", () => {
  function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  const screeningId = getQueryParam('screeningId');
  console.log("Extracted screeningId:", screeningId);
  let theatreId = null;
  let theatreConfig = null;
  let bookedSeats = [];

  // Fetch screening details to get TheatreID
  fetch(`/api/Screening/${screeningId}`)
    .then(res => {
      if (!res.ok) throw new Error("Failed to fetch screening details");
      return res.json();
    })
    .then(screening => {
      console.log("Fetched screening details:", screening);
      if (screening) {
        theatreId = screening.TheatreID;
        return fetch(`/api/Theatre/${theatreId}`);
      }
    })
    .then(res => {
      if (!res.ok) throw new Error("Failed to fetch theatre details");
      return res.json();
    })
    .then(theatre => {
      console.log("Fetched theatre details:", theatre);
      if (theatre) {
        theatreConfig = theatre;
        renderSeatingChart(theatre.Rows, theatre.Columns);
      }
    })
    .catch(err => {
      console.error("Error fetching screening/theatre:", err);
      alert("Failed to load screening or theatre details. Please try again.");
    });

  // Function to fetch booked seats and update the seating chart
  const fetchBookedSeats = () => {
    // Fetch tickets ONLY for the current screening
    fetch(`/api/Ticket?ScreeningID=${screeningId}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch tickets");
        return res.json();
      })
      .then(tickets => {
        console.log("Fetched tickets:", tickets);
        bookedSeats = tickets.map(ticket => ({
          row: ticket.SeatRow,
          col: ticket.SeatColumn
        }));
        if (theatreConfig) {
          renderSeatingChart(theatreConfig.Rows, theatreConfig.Columns);
        }
      })
      .catch(err => {
        console.error("Error fetching tickets:", err);
        alert("Failed to fetch booked seats. Please try again.");
      });
  };

  // Initial fetch for booked seats
  fetchBookedSeats();

  // Render the seating chart
  function renderSeatingChart(rows, cols) {
    const chartDiv = document.getElementById('seating-chart');
    if (!rows || !cols) return;
    chartDiv.innerHTML = '';
    for (let r = 1; r <= rows; r++) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'seat-row';
      for (let c = 1; c <= cols; c++) {
        const seatBtn = document.createElement('button');
        seatBtn.className = 'seat';
        seatBtn.textContent = `${r}-${c}`;
        const isBooked = bookedSeats.some(seat => seat.row === r && seat.col === c);
        if (isBooked) {
          seatBtn.disabled = true;
          seatBtn.classList.add('booked');
        } else {
          seatBtn.addEventListener('click', () => {
            seatBtn.classList.toggle('selected');
          });
        }
        rowDiv.appendChild(seatBtn);
      }
      chartDiv.appendChild(rowDiv);
    }
  }

  // Handle booking confirmation
  document.getElementById('confirm-booking').addEventListener('click', () => {
    const selectedSeats = [];
    document.querySelectorAll('.seat.selected').forEach(btn => {
      const [row, col] = btn.textContent.split('-').map(Number);
      selectedSeats.push({ row, col });
    });

    if (selectedSeats.length === 0) {
      alert("Please select at least one seat.");
      return;
    }

    const email = prompt("Please enter your email address:");
    if (!email) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    // Validate seat availability before proceeding
    fetch(`/api/Ticket?ScreeningID=${screeningId}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch tickets");
        return res.json();
      })
      .then(tickets => {
        const bookedSeats = tickets.map(ticket => ({
          row: ticket.SeatRow,
          col: ticket.SeatColumn
        }));

        // Check if any selected seat is already booked
        const isSeatAvailable = selectedSeats.every(seat =>
          !bookedSeats.some(booked => booked.row === seat.row && booked.col === seat.col)
        );

        if (!isSeatAvailable) {
          throw new Error("One or more selected seats are no longer available. Please refresh and try again.");
        }

        // Fetch Adult ticket cost
        return fetch(`/api/TicketType/Adult`);
      })
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch ticket cost");
        return res.json();
      })
      .then(ticketType => {
        const totalCost = selectedSeats.length * ticketType.Cost;

        // Create booking
        return fetch(`/api/Booking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            EmailAddress: email, 
            NoOfSeats: selectedSeats.length, 
            Cost: totalCost 
          })
        });
      })
      .then(res => {
        if (!res.ok) throw new Error("Failed to create booking");
        return res.json();
      })
      .then(bookingRes => {
        const bookingId = bookingRes.generatedId;

        // Create tickets for each selected seat
        const ticketPromises = selectedSeats.map(seat => {
          return fetch(`/api/Ticket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              BookingID: bookingId,
              ScreeningID: screeningId,
              SeatRow: seat.row,
              SeatColumn: seat.col
            })
          }).then(async (res) => {
            if (!res.ok) {
              const errorData = await res.json(); // Parse error message from backend
              throw new Error(errorData.error || "Failed to create ticket");
            }
            return res.json();
          });
        });

        return Promise.all(ticketPromises);
      })
      .then(() => {
        // Display success message
        const statusDiv = document.getElementById('booking-status');
        statusDiv.textContent = "Booking confirmed! Seats booked successfully.";
        statusDiv.className = "booking-status success";

        // Refresh booked seats
        fetchBookedSeats();
      })
      .catch(err => {
        console.error("Error:", err);

        // Display error message
        const statusDiv = document.getElementById('booking-status');
        statusDiv.textContent = `Error: ${err.message}`;
        statusDiv.className = "booking-status error";
      });
  });
});