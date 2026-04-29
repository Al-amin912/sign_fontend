const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const resultText = document.getElementById("result");

canvas.width = 640;
canvas.height = 480;

let latestFeatures = new Array(225).fill(0);
let handResults = null;
let busy = false;

// ================= CAMERA =================
navigator.mediaDevices.getUserMedia({ video: true })
.then(stream => {
  video.srcObject = stream;
  video.play();
});

// ================= POSE =================
const pose = new Pose({
  locateFile: file =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

// ================= HANDS =================
const hands = new Hands({
  locateFile: file =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults(res => {
  handResults = res;
});

// ================= FEATURE EXTRACTION =================
function extractFeatures(poseRes, handsRes) {

  let f = [];

  // POSE
  if (poseRes.poseLandmarks) {
    for (let lm of poseRes.poseLandmarks) {
      f.push(lm.x, lm.y, lm.z);
    }
  } else {
    f.push(...Array(99).fill(0));
  }

  // LEFT HAND
  if (handsRes?.multiHandLandmarks?.[0]) {
    for (let lm of handsRes.multiHandLandmarks[0]) {
      f.push(lm.x, lm.y, lm.z);
    }
  } else {
    f.push(...Array(63).fill(0));
  }

  // RIGHT HAND
  if (handsRes?.multiHandLandmarks?.[1]) {
    for (let lm of handsRes.multiHandLandmarks[1]) {
      f.push(lm.x, lm.y, lm.z);
    }
  } else {
    f.push(...Array(63).fill(0));
  }

  return f;
}

// ================= LOOP =================
async function loop() {

  if (busy) return;
  busy = true;

  await pose.send({ image: video });
  await hands.send({ image: video });

  busy = false;

  setTimeout(loop, 30);
}

// ================= DRAW =================
pose.onResults((results) => {

  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  // draw pose
  if (results.poseLandmarks) {
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS);
    drawLandmarks(ctx, results.poseLandmarks);
  }

  // draw hands
  if (handResults?.multiHandLandmarks) {
    for (const hand of handResults.multiHandLandmarks) {
      drawConnectors(ctx, hand, HAND_CONNECTIONS);
      drawLandmarks(ctx, hand);
    }
  }

  latestFeatures = extractFeatures(results, handResults);
});

// start loop
video.addEventListener("loadeddata", () => {
  loop();
});

// ================= PREDICT =================
function predict() {

  resultText.innerText = "Predicting...";

  fetch("https://sign-language-api-6mus.onrender.com/predict", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      landmarks: latestFeatures
    })
  })
  .then(res => res.json())
  .then(data => {
    resultText.innerText = "Prediction: " + data.prediction;
  })
  .catch(err => {
    console.log(err);
    resultText.innerText = "Error connecting to server";
  });
}