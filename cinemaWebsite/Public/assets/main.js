document.addEventListener('input', function(e) {
    if (e.target.tagName.toLowerCase() === 'input' && e.target.type === 'text') {
      const value = e.target.value;
      if (value && value[0] !== value[0].toUpperCase()) {
        e.target.value = value.charAt(0).toUpperCase() + value.slice(1);
      }
    }
  });
  