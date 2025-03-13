document.addEventListener("DOMContentLoaded", () => {
  fetch('/api/Film')
      .then(response => response.json())
      .then(films => {
          console.log("Fetched films:", films); // ✅ Debugging

          const container = document.getElementById('film-container');
          container.innerHTML = ''; // Clear previous content

          films.forEach(film => {
              const filmId = film.FilmID; // ✅ Correctly using capitalized document ID
              console.log("Using Film Document ID:", filmId); // ✅ Debugging

              const card = document.createElement('div');
              card.className = 'film-card';
              card.innerHTML = `
                  <img src="${film.Poster || ''}" alt="${film.Name} Poster">
                  <div class="film-info">
                      <h3>${film.Name}</h3>
                      <p>${film.Genre} | ${film.Duration} mins</p>
                      <button class="view-details-btn" data-id="${filmId}">View Details</button>
                  </div>
              `;
              container.appendChild(card);
          });

          document.querySelectorAll('.view-details-btn').forEach(button => {
              button.addEventListener('click', () => {
                  const filmId = button.getAttribute('data-id');
                  console.log("Clicked Film Document ID:", filmId); // ✅ Debugging
                  window.location.href = `film.html?filmId=${encodeURIComponent(filmId)}`;
              });
          });
      })
      .catch(err => console.error("Error fetching films: ", err));
});
