const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const feedbackBox = document.getElementById("feedback");

let baselineHead = null;
let calibrationStart = Date.now();

function resizeCanvas() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/* ---------- POSE ---------- */
const pose = new Pose({
  locateFile: file =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6,
});

pose.onResults(onResults);

/* ---------- CAMERA ---------- */
const camera = new Camera(video, {
  onFrame: async () => {
    await pose.send({ image: video });
  },
  facingMode: "environment",
});

camera.start();

/* ---------- DRAW HELPERS ---------- */
function drawGravityLine(hipX) {
  ctx.strokeStyle = "gray";
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(hipX * canvas.width, 0);
  ctx.lineTo(hipX * canvas.width, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);
}

/* ---------- MAIN LOOP ---------- */
function onResults(results) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!results.poseLandmarks) return;
  const lm = results.poseLandmarks;

  /* ----- Skeleton ----- */
  drawConnectors(ctx, lm, POSE_CONNECTIONS, {
    color: "#0077ff",
    lineWidth: 3,
  });

  /* ----- Head Bounding Box ----- */
  const headIds = [0,1,2,7,8];
  const pts = headIds.map(i => lm[i]);

  const minX = Math.min(...pts.map(p => p.x));
  const maxX = Math.max(...pts.map(p => p.x));
  const minY = Math.min(...pts.map(p => p.y));
  const maxY = Math.max(...pts.map(p => p.y));

  ctx.strokeStyle = "green";
  ctx.lineWidth = 3;
  ctx.strokeRect(
    minX * canvas.width,
    minY * canvas.height,
    (maxX - minX) * canvas.width,
    (maxY - minY) * canvas.height
  );

  const headCenter = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };

  /* ----- Calibration ----- */
  if (!baselineHead && Date.now() - calibrationStart > 2000) {
    baselineHead = headCenter;
    feedbackBox.innerText = "Calibration complete ✅";
  }

  if (!baselineHead) {
    feedbackBox.innerText = "Stand still – calibrating…";
    return;
  }

  /* ----- Head Drift ----- */
  const drift = Math.hypot(
    headCenter.x - baselineHead.x,
    headCenter.y - baselineHead.y
  );

  /* ----- Gravity Line ----- */
  const hipCenterX = (lm[23].x + lm[24].x) / 2;
  drawGravityLine(hipCenterX);

  /* ----- Feedback ----- */
  feedbackBox.innerText =
    drift > 0.02 ? "Keep head still" : "Good balance 👍";
}
