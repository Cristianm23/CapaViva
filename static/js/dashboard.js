import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  limitToLast,
  onValue,
  orderByKey,
  query,
  ref,
} from 'firebase/database';

// Estos valores se insertan al compilar desde el archivo .env local.
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
};

const estadoConexion = document.getElementById('connection-status');
const etiquetaConexion = document.getElementById('connection-label');
let graficaTemperatura;
let graficaHumedad;

function cambiarEstado(estado, mensaje) {
  estadoConexion.dataset.state = estado;
  etiquetaConexion.textContent = mensaje;
}

function horaDe(fecha) {
  const milisegundos = Number(fecha);
  if (!Number.isFinite(milisegundos)) return '—';
  return new Date(milisegundos).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatoNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toFixed(1) : '--';
}

function crearGrafica(canvasId, etiqueta, color) {
  const contexto = document.getElementById(canvasId);
  return new Chart(contexto, {
    type: 'line',
    data: { labels: [], datasets: [{
      label: etiqueta,
      data: [],
      borderColor: color,
      backgroundColor: `${color}20`,
      borderWidth: 2,
      pointRadius: 2,
      pointHoverRadius: 4,
      fill: true,
      tension: 0.35,
    }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6, color: '#87928a', font: { size: 9 } } },
        y: { beginAtZero: false, grid: { color: 'rgba(130, 145, 135, .15)' }, ticks: { color: '#87928a', font: { size: 9 } } },
      },
    },
  });
}

function actualizarGrafica(grafica, lecturas, campo) {
  const recientes = lecturas.slice(-30);
  grafica.data.labels = recientes.map((lectura) => horaDe(lectura.fecha));
  grafica.data.datasets[0].data = recientes.map((lectura) => Number(lectura[campo]));
  grafica.update();
}

function mostrarTabla(lecturas) {
  const cuerpo = document.getElementById('readings-body');
  const recientes = lecturas.slice(-10).reverse();

  if (recientes.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="4" class="empty-row">Aún no hay lecturas disponibles.</td></tr>';
    return;
  }

  cuerpo.innerHTML = recientes.map((lectura) => {
    const encendido = Number(lectura.bombillo) === 1;
    return `<tr>
      <td>${horaDe(lectura.fecha)}</td>
      <td>${formatoNumero(lectura.temperatura)} °C</td>
      <td>${formatoNumero(lectura.humedad)} %</td>
      <td><span class="table-bulb ${encendido ? 'on' : ''}">${encendido ? 'Encendido' : 'Apagado'}</span></td>
    </tr>`;
  }).join('');
}

function mostrarEstadisticas(lecturas) {
  const temperatura = lecturas.map((lectura) => Number(lectura.temperatura)).filter(Number.isFinite);
  const humedad = lecturas.map((lectura) => Number(lectura.humedad)).filter(Number.isFinite);
  const estadistica = (valores) => valores.length
    ? { min: Math.min(...valores), max: Math.max(...valores), avg: valores.reduce((suma, valor) => suma + valor, 0) / valores.length }
    : null;

  const temp = estadistica(temperatura);
  const hum = estadistica(humedad);
  document.getElementById('temp-min').textContent = temp ? formatoNumero(temp.min) : '--';
  document.getElementById('temp-max').textContent = temp ? formatoNumero(temp.max) : '--';
  document.getElementById('temp-avg').textContent = temp ? formatoNumero(temp.avg) : '--';
  document.getElementById('humidity-min').textContent = hum ? formatoNumero(hum.min) : '--';
  document.getElementById('humidity-max').textContent = hum ? formatoNumero(hum.max) : '--';
  document.getElementById('humidity-avg').textContent = hum ? formatoNumero(hum.avg) : '--';
  document.getElementById('reading-count').textContent = lecturas.length;
}

function mostrarLecturas(lecturas) {
  if (lecturas.length === 0) {
    cambiarEstado('empty', 'Conectado · sin datos');
    document.getElementById('current-temperature').textContent = '--';
    document.getElementById('current-humidity').textContent = '--';
    document.getElementById('current-bulb').textContent = 'Sin lectura';
    document.getElementById('bulb-indicator').dataset.on = 'false';
    document.getElementById('last-updated').textContent = '—';
  } else {
    const actual = lecturas[lecturas.length - 1];
    const encendido = Number(actual.bombillo) === 1;
    cambiarEstado('connected', 'Conectado');
    document.getElementById('current-temperature').textContent = formatoNumero(actual.temperatura);
    document.getElementById('current-humidity').textContent = formatoNumero(actual.humedad);
    document.getElementById('current-bulb').textContent = encendido ? 'Encendido' : 'Apagado';
    document.getElementById('bulb-indicator').dataset.on = String(encendido);
    document.getElementById('last-updated').textContent = horaDe(actual.fecha);
  }

  actualizarGrafica(graficaTemperatura, lecturas, 'temperatura');
  actualizarGrafica(graficaHumedad, lecturas, 'humedad');
  mostrarTabla(lecturas);
  mostrarEstadisticas(lecturas);
}

function iniciarDashboard() {
  graficaTemperatura = crearGrafica('temperature-chart', 'Temperatura', '#13835d');
  graficaHumedad = crearGrafica('humidity-chart', 'Humedad', '#3976b9');

  if (!firebaseConfig.databaseURL || firebaseConfig.databaseURL.includes('TU-PROYECTO')) {
    cambiarEstado('error', 'Configura la URL de Realtime Database en .env');
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    const database = getDatabase(app);
    const ultimasLecturas = query(ref(database, 'lecturas'), orderByKey(), limitToLast(100));

    // La suscripción actualiza la interfaz cada vez que Firebase recibe una lectura.
    onValue(ultimasLecturas, (snapshot) => {
      const lecturas = [];
      snapshot.forEach((hijo) => lecturas.push(hijo.val()));
      mostrarLecturas(lecturas);
    }, () => cambiarEstado('error', 'No se pudo leer Firebase'));
  } catch (error) {
    console.error('Error al iniciar Firebase:', error);
    cambiarEstado('error', 'Error de configuración de Firebase');
  }
}

iniciarDashboard();
