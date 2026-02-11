// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// 【重要】Adminと同じFirebaseの設定をここに貼り付けてください
const firebaseConfig = {
    apiKey: "AIzaSyC0Q3rb95mzrlPAfkOmAhFxbDzvxVTeH6c",
    authDomain: "farm-gauge.firebaseapp.com",
    projectId: "farm-gauge",
    storageBucket: "farm-gauge.firebasestorage.app",
    messagingSenderId: "618463173182",
    appId: "1:618463173182:web:7fdc8b05df885efa898f6f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 時計
setInterval(() => {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString();
}, 1000);

let sensorDataLog = [];
let chart;

// ============================================
// Firebaseからデータを受信 (リアルタイム)
// ============================================
// 最新300件を取得
const q = query(collection(db, "sensor_logs"), orderBy("timestamp", "desc"), limit(300));

onSnapshot(q, (snapshot) => {
    // データ更新があるたびに実行される
    sensorDataLog = snapshot.docs.map(doc => doc.data()).reverse(); // 古い順に並べ替え
    console.log("データ受信:", sensorDataLog.length + "件");
    
    if(sensorDataLog.length > 0) {
        updateUI();
    }
});

function updateUI() {
    const latest = sensorDataLog[sensorDataLog.length - 1];
    
    // 最新値表示
    for (const [key, val] of Object.entries(latest.values)) {
        const el = document.getElementById(key);
        if (el) el.textContent = (val !== null ? val : "--") + " °C";
    }

    // 平均値
    showGroupAverages();
    showYesterdayAverages();

    // グラフ
    drawMultiChart();
}

// ============================================
// 平均値計算
// ============================================
function calculateAverage(startTime, endTime) {
    const recent = sensorDataLog.filter(entry => {
        const t = new Date(entry.timestamp);
        return t >= startTime && t <= endTime;
    });
    if (recent.length === 0) return null;

    const sum = {};
    const count = {};
    recent.forEach(entry => {
        for (const [key, value] of Object.entries(entry.values)) {
            if (value == null) continue;
            if (!sum[key]) { sum[key] = 0; count[key] = 0; }
            sum[key] += value;
            count[key] += 1;
        }
    });
    const averages = {};
    for (const key of Object.keys(sum)) averages[key] = sum[key] / count[key];
    return averages;
}

function showGroupAverages() {
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const avg = calculateAverage(start, now);
    if(avg) updateGroupDisplays(avg, "soil-main-avg", "soil-10-avg");
}

function showYesterdayAverages() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    const avg = calculateAverage(start, end);
    if(avg) updateGroupDisplays(avg, "soil-main-avg-yesterday", "soil-10-avg-yesterday");
}

function updateGroupDisplays(avg, northId, ewId) {
    const nKeys = ["soil2n", "soil5n", "soil8n"];
    const ewKeys = ["soil10e", "soil10w"];
    
    const calc = (keys) => {
        let total = 0, cnt = 0;
        keys.forEach(k => { if(avg[k] !== undefined) { total += avg[k]; cnt++; }});
        return cnt > 0 ? (total/cnt).toFixed(2) : "--";
    };

    document.getElementById(northId).textContent = calc(nKeys) + " °C";
    document.getElementById(ewId).textContent = calc(ewKeys) + " °C";
}

// ============================================
// グラフ描画
// ============================================
function drawMultiChart() {
    // 直近24時間にフィルタ
    const recentData = sensorDataLog.filter(entry => new Date(entry.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000));
    if (recentData.length === 0) return;

    const labels = recentData.map(entry => new Date(entry.timestamp));
    
    const datasets = [
        { label: "本2北地", key: "soil2n", color: "#4bc0c0" },
        { label: "本5北地", key: "soil5n", color: "#ff9f40" },
        { label: "本8北地", key: "soil8n", color: "#9966ff" },
        { label: "育西地", key: "soil10e", color: "#ff6384" },
        { label: "育東地", key: "soil10w", color: "#36a2eb" }
    ].map(setting => ({
        label: setting.label + " (°C)",
        data: recentData.map(e => e.values[setting.key] ?? null),
        borderColor: setting.color,
        backgroundColor: setting.color + "33",
        yAxisID: "y1",
        tension: 0.3,
        fill: false,
        spanGaps: true
    }));

    // 00:00ライン用プラグイン
    const midnightLinesPlugin = {
        id: 'midnightLines',
        afterDraw: (chart) => {
            const xAxis = chart.scales.x;
            const yAxis = chart.scales.y1;
            if (!xAxis || !yAxis) return;
            const ctx = chart.ctx;
            const min = xAxis.min;
            const max = xAxis.max;
            let current = new Date(min);
            current.setHours(0, 0, 0, 0);
            while (current.getTime() <= max) {
                const x = xAxis.getPixelForValue(current);
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(x, yAxis.top);
                ctx.lineTo(x, yAxis.bottom);
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#e6e6e6';
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.restore();
                current.setDate(current.getDate() + 1);
            }
        }
    };

    if (chart) chart.destroy();
    
    chart = new Chart(document.getElementById("multchart"), {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            animation: false,
            plugins: {
                legend: { display: false },
                title: { display: true, color: "#c8c8c8" }
            },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'hour', displayFormats: { hour: 'HH:mm' } },
                    ticks: { color: "#c8c8c8" },
                    grid: { color: "#c8c8c8" },
                    // 右端に少し余裕を持たせる設定
                    max: (function() {
                        const d = new Date();
                        d.setMinutes(0,0,0);
                        d.setHours(d.getHours() + 1);
                        return d;
                    })()
                },
                y1: {
                    type: "linear",
                    position: "left",
                    ticks: { color: "#c8c8c8", stepSize: 5 },
                    grid: { color: "#c8c8c8" },
                    min: 10, max: 40
                }
            },
            plugins: [midnightLinesPlugin]
        }
    });
}