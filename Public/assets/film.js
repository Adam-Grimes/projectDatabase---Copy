document.addEventListener("DOMContentLoaded", () => {
  function getQueryParam(name) {
      const params = new URLSearchParams(window.location.search);
      return params.get(name);
  }

  const filmId = getQueryParam('filmId'); // ✅ Now fetching correct capitalized ID
  console.log("Fetching Film with Document ID:", filmId); // ✅ Debugging

  if (!filmId) {
      console.error("No filmId provided in URL!");
      return;
  }

  // Fetch film details by Document ID
  fetch(`/api/Film/${encodeURIComponent(filmId)}`)
      .then(res => res.json())
      .then(film => {
          console.log("Fetched Film Data:", film); // ✅ Debugging
          if (film.Name) {
              document.getElementById('film-details').innerHTML = `
                  <img src="${film.Poster || ''}" alt="${film.Name} Poster">
                  <div class="film-detail-info">
                      <h2>${film.Name}</h2>
                      <p><strong>Genre:</strong> ${film.Genre}</p>
                      <p><strong>Category:</strong> ${film.Category}</p>
                      <p><strong>Duration:</strong> ${film.Duration} minutes</p>
                      <a href="${film.Trailer}" target="_blank" class="trailer-btn">Watch Trailer</a>
                  </div>
              `;
          } else {
              document.getElementById('film-details').innerHTML = `<p>Film not found.</p>`;
          }
      })
      .catch(err => console.error("Error fetching film details:", err));

  // Fetch screenings for this film
  fetch(`/api/Screening/byFilm/${encodeURIComponent(filmId)}`)
      .then(res => res.json())
      .then(screenings => {
          console.log("Fetched Screenings:", screenings); // ✅ Debugging
          const screeningsDiv = document.getElementById('screenings');
          if (!screenings || screenings.length === 0) {
              screeningsDiv.innerHTML = `<p>No screenings available.</p>`;
              return;
          }
          screenings.forEach(screening => {
              const screeningElem = document.createElement('div');
              screeningElem.className = 'screening-item';
              screeningElem.innerHTML = `
                  <p>Date: ${screening.Date} | Start: ${screening.StartTime}</p>
                  <button class="book-now-btn" data-id="${screening.ScreeningID}">Book Now</button>
              `;
              screeningsDiv.appendChild(screeningElem);
          });

          // Attach event listeners for "Book Now" buttons
          document.querySelectorAll('.book-now-btn').forEach(button => {
              button.addEventListener('click', () => {
                  const screeningId = button.getAttribute('data-id');
                  window.location.href = `booking.html?screeningId=${screeningId}`;
              });
          });
      })
      .catch(err => console.error("Error fetching screenings:", err));
});
