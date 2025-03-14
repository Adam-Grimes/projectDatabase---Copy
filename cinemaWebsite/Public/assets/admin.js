document.addEventListener("DOMContentLoaded", () => {
    const collections = document.querySelectorAll("#collections li");
    const collectionTitle = document.getElementById("collection-title");
    const itemsTableBody = document.querySelector("#items-table tbody");
    const modal = document.getElementById("modal");
    const closeButton = document.querySelector(".close-button");
    const createButton = document.getElementById("create-button");
    const itemForm = document.getElementById("item-form");
    let activeCollection = "Booking"; // Default collection
    let currentItem = null;
    let items = [];
    let activeCollectionButton = null;

    // Collection configuration with auto-generated IDs
    const collectionConfig = {
        Booking: { idField: 'BookingID', fields: ['NoOfSeats', 'Cost', 'EmailAddress'], autoGenerateId: true },
        Film: { idField: 'FilmID', fields: ['Name', 'Category', 'Genre', 'Duration', 'Trailer', 'Poster'], autoGenerateId: false },
        Screening: { idField: 'ScreeningID', fields: ['FilmID', 'TheatreID', 'Date', 'StartTime'], autoGenerateId: true },
        Theatre: { idField: 'TheatreID', fields: ['Columns', 'Rows'], autoGenerateId: true },
        Ticket: { idField: 'TicketID', fields: ['BookingID', 'ScreeningID', 'TicketType'], autoGenerateId: true },
        TicketType: { idField: 'TicketTypeID', fields: ['Cost'], autoGenerateId: false }
    };

    // Foreign key relationships
    const foreignKeys = {
        Screening: {
            'FilmID': 'Film',
            'TheatreID': 'Theatre'
        },
        Ticket: {
            'BookingID': 'Booking',
            'ScreeningID': 'Screening',
            'TicketType': 'TicketType'
        }
    };

    // Fetch data from API
    const fetchData = async () => {
        try {
            const config = collectionConfig[activeCollection];
            if (!config) {
                throw new Error(`Configuration not found for collection: ${activeCollection}`);
            }

            const res = await fetch(`/api/${activeCollection}`);
            if (!res.ok) {
                throw new Error(`API request failed with status: ${res.status}`);
            }

            items = await res.json();
            populateTable(items);
        } catch (error) {
            console.error(`Error fetching data: ${error.message}`);
        }
    };

    // Generate form fields with dropdowns for foreign keys
    const generateFormFields = async () => {
        itemForm.innerHTML = '';
        const config = collectionConfig[activeCollection];
        if (!config) {
            throw new Error(`Configuration not found for collection: ${activeCollection}`);
        }

        const isEditing = !!currentItem;

        const createFormGroup = (fieldName, inputElement) => {
            const group = document.createElement('div');
            group.className = 'form-group';

            const label = document.createElement('label');
            label.textContent = fieldName;
            label.htmlFor = inputElement.id;

            group.appendChild(label);
            group.appendChild(inputElement);
            return group;
        };

        // Add alert container
        const alertContainer = document.createElement('div');
        alertContainer.id = 'form-alert';
        alertContainer.className = 'alert-message';
        itemForm.prepend(alertContainer);

        // Add ID field only if editing or not auto-generated
        if (!isEditing && config.idField && !config.autoGenerateId) {
            const idInput = document.createElement('input');
            idInput.type = 'text';
            idInput.id = `item-${config.idField}`;
            idInput.name = config.idField;
            idInput.required = true;
            itemForm.appendChild(createFormGroup(config.idField, idInput));
        }

        // Process foreign key dropdowns
        if (foreignKeys[activeCollection]) {
            const fkData = foreignKeys[activeCollection];
            const fetchPromises = Object.entries(fkData).map(([field, collection]) =>
                fetch(`/api/${collection}`).then(res => res.json())
            );
            const fetchedData = await Promise.all(fetchPromises);

            Object.entries(fkData).forEach(([field, collection], index) => {
                const data = fetchedData[index];
                const idField = collectionConfig[collection].idField;

                const select = document.createElement('select');
                select.id = `item-${field}`;
                select.name = field;
                select.required = true;

                // Default option
                const defaultOption = document.createElement('option');
                defaultOption.disabled = true;
                defaultOption.selected = true;
                defaultOption.textContent = `Select ${field}`;
                select.appendChild(defaultOption);

                data.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item[idField];
                    option.textContent = item[idField];
                    if (currentItem && currentItem[field] === item[idField]) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });

                const group = createFormGroup(field, select);
                itemForm.appendChild(group);
            });
        }

        // Process non-foreign key fields
        config.fields.forEach(field => {
            if (foreignKeys[activeCollection]?.[field]) return;

            if (field === 'Poster') {
                // Special handling for image upload
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/jpeg';
                fileInput.id = 'item-Poster';
                fileInput.className = 'file-input';

                // Preview container
                const previewContainer = document.createElement('div');
                previewContainer.className = 'image-preview';

                // Existing image preview (for edits)
                if (currentItem?.Poster) {
                    const img = document.createElement('img');
                    img.src = currentItem.Poster;
                    img.style.maxWidth = '200px';
                    previewContainer.appendChild(img);
                }

                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file && file.type === 'image/jpeg') {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            previewContainer.innerHTML = '';
                            const img = document.createElement('img');
                            img.src = event.target.result;
                            img.style.maxWidth = '200px';
                            previewContainer.appendChild(img);
                            document.getElementById('poster-base64').value = event.target.result;
                        };
                        reader.readAsDataURL(file);
                    }
                });

                // Hidden input to store base64 string
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.id = 'poster-base64';
                hiddenInput.name = 'Poster';

                const group = createFormGroup('Poster (JPEG)', fileInput);
                group.appendChild(hiddenInput);
                group.appendChild(previewContainer);
                itemForm.appendChild(group);
            } else {
                const input = document.createElement('input');
                input.id = `item-${field}`;
                input.name = field;
                input.required = true;

                // Set input types and validation
                switch(field) {
                    case 'Date':
                        input.type = 'date';
                        const today = new Date().toISOString().split('T')[0];
                        const maxDate = new Date();
                        maxDate.setMonth(maxDate.getMonth() + 1); // 1 month in advance
                        const maxDateStr = maxDate.toISOString().split('T')[0];
                        input.min = today;
                        input.max = maxDateStr;
                        break;
                    case 'StartTime':
                        input.type = 'time';
                        input.min = '09:00';
                        input.max = '23:00';
                        break;
                    case 'Rows':
                    case 'Columns':
                        input.type = 'number';
                        input.min = 1;
                        break;
                    case 'Cost':
                    case 'SeatsRemaining':
                    case 'Capacity':
                    case 'Duration':
                    case 'NoOfSeats':
                        input.type = 'number';
                        input.min = 0;
                        if (field === 'Cost') input.step = 0.01;
                        break;
                    case 'EmailAddress':
                        input.type = 'email';
                        break;
                    default:
                        input.type = 'text';
                }

                const group = createFormGroup(field, input);
                itemForm.appendChild(group);
            }
        });

        // Submit button
        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.className = 'submit-button';
        submitButton.textContent = currentItem ? 'Update' : 'Create';
        itemForm.appendChild(submitButton);
    };

    // Populate table with data
    const populateTable = (items) => {
        itemsTableBody.innerHTML = "";
        const config = collectionConfig[activeCollection];
        if (!config) {
            throw new Error(`Configuration not found for collection: ${activeCollection}`);
        }

        items.forEach(item => {
            const row = document.createElement("tr");
            const itemId = item[config.idField];

            const infoDisplay = document.createElement('div');
            infoDisplay.className = 'info-display';
            const displayValues = config.fields.map(field => {
                return field === 'Poster' && item[field]
                    ? 'Poster: (Image Available)'
                    : `${field}: ${item[field] || 'N/A'}`;
            });
            infoDisplay.textContent = displayValues.join(' | ');

            row.innerHTML = `
                <td>${itemId}</td>
                <td></td>
                <td>
                    <button class="edit-button" data-id="${itemId}">Edit</button>
                    <button class="delete-button" data-id="${itemId}">Delete</button>
                </td>
            `;
            row.querySelector('td:nth-child(2)').appendChild(infoDisplay);
            itemsTableBody.appendChild(row);
        });

        // Add event listeners
        document.querySelectorAll(".edit-button").forEach(button => {
            button.addEventListener("click", () => editItem(button.dataset.id));
        });

        document.querySelectorAll(".delete-button").forEach(button => {
            button.addEventListener("click", () => deleteItem(button.dataset.id));
        });
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        const config = collectionConfig[activeCollection];
        if (!config) {
            throw new Error(`Configuration not found for collection: ${activeCollection}`);
        }
    
        const formData = new FormData(itemForm);
        const payload = {};
    
        try {
            // Only include ID for non-auto-generated collections during creation
            if (!currentItem && !config.autoGenerateId) {
                const idValue = formData.get(config.idField);
                if (!idValue) throw new Error(`${config.idField} is required`);
                payload[config.idField] = idValue;
            }
    
            // Process fields
            config.fields.forEach(field => {
                const value = field === 'Poster'
                    ? document.getElementById('poster-base64').value
                    : formData.get(field);
    
                if (!value && value !== 0 && field !== 'Poster') {
                    throw new Error(`${field} is required`);
                }
    
                // Convert numeric fields
                if (['Cost', 'SeatsRemaining', 'Capacity', 'NoOfSeats', 'Duration', 'Rows', 'Columns'].includes(field)) {
                    payload[field] = Number(value);
                } else {
                    payload[field] = value?.trim() || null;
                }
            });
    
            // Auto-calculate capacity for Theatre
            if (activeCollection === 'Theatre') {
                payload.Capacity = payload.Rows * payload.Columns;
            }
    
            const url = currentItem
                ? `/api/${activeCollection}/${currentItem[config.idField]}`
                : `/api/${activeCollection}`;
    
            const response = await fetch(url, {
                method: currentItem ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
    
            if (!response.ok) {
                const errorResponse = await response.json(); // Parse the JSON error response
                if (errorResponse.error) {
                    throw new Error(errorResponse.error); // Extract the "error" field
                } else {
                    throw new Error("An unexpected error occurred.");
                }
            }
    
            fetchData();
            closeModal();
        } catch (error) {
            const alertContainer = document.getElementById('form-alert');
            if (alertContainer) {
                // Display the clean error message
                alertContainer.textContent = error.message;
                alertContainer.classList.add('visible');
                alertContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    };

    // Edit item
    const editItem = async (id) => {
        const config = collectionConfig[activeCollection];
        if (!config) {
            throw new Error(`Configuration not found for collection: ${activeCollection}`);
        }

        currentItem = items.find(item => item[config.idField] === id);

        if (!currentItem) {
            console.error("Item not found!");
            return;
        }

        await generateFormFields();

        // Populate form fields
        config.fields.forEach(field => {
            if (field === 'Poster') {
                if (currentItem.Poster) {
                    document.getElementById('poster-base64').value = currentItem.Poster;
                }
            } else {
                const input = document.querySelector(`#item-${field}`);
                if (input) {
                    let value = currentItem[field];
                    if (typeof value === 'number' && field === 'Cost') {
                        value = value.toFixed(2);
                    }
                    input.value = value || '';
                }
            }
        });

        openModal();
    };

    // Delete item
    const deleteItem = async (id) => {
        if (!confirm("Are you sure you want to delete this item?")) return;

        try {
            const response = await fetch(`/api/${activeCollection}/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Delete failed');
            fetchData();
        } catch (error) {
            console.error(`Error deleting item: ${error.message}`);
        }
    };

    // Helper functions
    const openModal = () => {
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";
    };

    const closeModal = () => {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
        currentItem = null;
        itemForm.reset();
        document.getElementById('poster-base64')?.remove();
        const alertContainer = document.getElementById('form-alert');
        if (alertContainer) {
            alertContainer.textContent = '';
            alertContainer.classList.remove('visible');
        }
    };

    // Event listeners
    collections.forEach(collection => {
        collection.addEventListener("click", () => {
            if (activeCollectionButton) {
                activeCollectionButton.classList.remove('active');
            }
            activeCollection = collection.dataset.collection;
            collectionTitle.textContent = activeCollection;
            collection.classList.add('active');
            activeCollectionButton = collection;
            fetchData();
        });
    });

    const initialButton = document.querySelector(`[data-collection="${activeCollection}"]`);
    if (initialButton) {
        initialButton.classList.add('active');
        activeCollectionButton = initialButton;
    }

    createButton.addEventListener("click", async () => {
        currentItem = null;
        await generateFormFields();
        openModal();
    });

    closeButton.addEventListener("click", closeModal);
    itemForm.addEventListener("submit", handleSubmit);

    // Initial load
    fetchData();
});