async function rAgenda() {
  const el = document.getElementById('page-agenda');
  el.innerHTML = `
    <div class="page-body">
      <div class="page-header">
        <h1 class="page-title">Agenda</h1>
      </div>
      <div class="coming-soon-card">
        <div class="coming-soon-icon">🗓️</div>
        <p class="coming-soon-text">Próximamente disponible</p>
      </div>
    </div>`;
}
