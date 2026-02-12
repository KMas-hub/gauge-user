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
// 計算対象のセンサーキー一覧を定義
// ============================================
const targetKeys = [
    "temp1n", "soil1n",
    "temp2n", "soil2n",
    "temp3n", "soil3n",
    "temp4n", "soil4n",
    "temp5n", "soil5n",
    "temp6n", "soil6n",
    "temp7n", "soil7n",
    "temp8n", "soil8n",
    "temp9n", "soil9n"
];

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
    showCurrentAverages();
    showYesterdayAverages();

    // グラフ
    drawMultiChart();
}

// ============================================
// 平均値計算 (個別に集計するロジックへ変更)
// ============================================
function calculateAverage(startTime, endTime) {
    const recent = sensorDataLog.filter(entry => {
        const t = new Date(entry.timestamp);
        return t >= startTime && t <= endTime;
    });

    if (recent.length === 0) return null;

    const sum = {};
    const count = {};

    // 初期化
    targetKeys.forEach(key => {
        sum[key] = 0;
        count[key] = 0;
    });

    // 集計
    recent.forEach(entry => {
        // 定義されたキーについてのみ集計
        targetKeys.forEach(key => {
            const val = entry.values[key];
            if (val != null) { // nullまたはundefinedでない場合
                sum[key] += val;
                count[key] += 1;
            }
        });
    });

    // 平均算出
    const averages = {};
    targetKeys.forEach(key => {
        if (count[key] > 0) {
            averages[key] = sum[key] / count[key];
        } else {
            averages[key] = null;
        }
    });
    
    return averages;
}

// 直近24時間の平均を表示
function showCurrentAverages() {
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const avg = calculateAverage(start, now);
    
    // suffix(接尾辞)なしで呼び出し -> IDは "temp1n-avg" 等になる
    if(avg) updateIndividualDisplays(avg, ""); 
}

// 昨日の平均を表示
function showYesterdayAverages() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    const avg = calculateAverage(start, end);

    // suffixを "-yesterday" に指定 -> IDは "temp1n-avg-yesterday" 等になる
    if(avg) updateIndividualDisplays(avg, "-yesterday");
}

// ============================================
// 個別の平均値をHTMLに反映する関数
// ============================================
function updateIndividualDisplays(avg, suffix) {
    targetKeys.forEach(key => {
        // ID生成: 変数名 + "-avg" + (昨日の場合は "-yesterday")
        const elementId = key + "-avg" + suffix;
        const element = document.getElementById(elementId);

        if (element) {
            if (avg[key] !== null) {
                element.textContent = avg[key].toFixed(1) + " °C";
            } else {
                element.textContent = "--";
            }
        }
    });
}

// ============================================
// グラフ描画
// ============================================
function drawMultiChart() {
    const now = new Date();

    const timeWindow = 48 * 60 * 60 * 1000;
    const recentData = sensorDataLog.filter(entry => new Date(entry.timestamp) > new Date(now.getTime() - timeWindow));
    //const recentData = sensorDataLog.filter(entry => new Date(entry.timestamp) > new Date(Date.now() - 48 * 60 * 60 * 1000));
    if (recentData.length === 0) return;

    const labels = recentData.map(entry => new Date(entry.timestamp));
    
    const datasets = [
        { label: "House1気温", key: "temp1n", color: "#FFCDD2" },
        { label: "House1地温", key: "soil1n", color: "#FFCCBC" },
        { label: "House2気温", key: "temp2n", color: "#FFE0B2" },
        { label: "House2地温", key: "soil2n", color: "#FFECB3" },
        { label: "House3気温", key: "temp3n", color: "#FFF9C4" },
        { label: "House3地温", key: "soil3n", color: "#F0F4C3" },
        { label: "House4気温", key: "temp4n", color: "#DCEDC8" },
        { label: "House4地温", key: "soil4n", color: "#C8E6C9" },
        { label: "House5気温", key: "temp5n", color: "#B2DFDB" },
        { label: "House5地温", key: "soil5n", color: "#B2EBF2" },
        { label: "House6気温", key: "temp6n", color: "#B3E5FC" },
        { label: "House6地温", key: "soil6n", color: "#BBDEFB" },
        { label: "House7気温", key: "temp7n", color: "#C5CAE9" },
        { label: "House7地温", key: "soil7n", color: "#D1C4E9" },
        { label: "House8気温", key: "temp8n", color: "#E1BEE7" },
        { label: "House8地温", key: "soil8n", color: "#F8BBD0" },
        { label: "House9気温", key: "temp9n", color: "#F48FB1" },
        { label: "House9地温", key: "soil9n", color: "#D7CCC8" },

    ].map(setting => ({
        label: setting.label + " (°C)",
        data: recentData.map(e => e.values[setting.key] ?? null),
        borderColor: setting.color,
        backgroundColor: setting.color + "33",
        yAxisID: "y1",
        tension: 0.3,
        fill: false,
        spanGaps: true,
        pointRadius: 0
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
                // 範囲内の日付のみ描画
                if (current.getTime() >= min) {
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
                }
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
                    time: { 
                        unit: 'hour', 
                        displayFormats: { hour: 'HH:mm' }, 
                        stepSize: 6
                    },
                    ticks: { color: "#c8c8c8", maxRotation: 0, autoSkip: true },
                    grid: { color: "#c8c8c8" },
                    // 右端に少し余裕を持たせる設定
                    max: (function() {
                        const d = new Date();
                        d.setMinutes(0,0,0);
                        d.setHours(d.getHours() + 3);
                        return d;
                    }),
                    min: new Date(now.getTime() - timeWindow)
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
