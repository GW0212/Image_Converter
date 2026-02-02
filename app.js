const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');

const previewWrap = document.getElementById('previewWrap');
const preview = document.getElementById('preview');
const previewEmpty = document.getElementById('previewEmpty');
const previewBox = document.querySelector('.preview-box');

const origSize = document.getElementById('origSize');
const origName = document.getElementById('origName');

const widthInput = document.getElementById('widthInput');
const heightInput = document.getElementById('heightInput');
const formatSelect = document.getElementById('formatSelect');
const qualityInput = document.getElementById('qualityInput');
const qualityLabel = document.getElementById('qualityLabel');

const startBtn = document.getElementById('startBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusEl = document.getElementById('status');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let selectedFile = null;
let loadedImage = null;
let outputBlob = null;
let outputUrl = null;

function setStatus(msg){ statusEl.textContent = msg || ''; }

function resetOutput(){
  outputBlob = null;
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  outputUrl = null;
  downloadBtn.disabled = true;
}

function getExtFromMime(mime){
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  return 'png';
}

function sanitizeBaseName(name){
  const base = (name || 'image').replace(/\.[^/.]+$/, '');
  return base.replace(/[^a-zA-Z0-9가-힣 _-]/g, '_').trim() || 'image';
}

function clampInt(val, fallback){
  const n = parseInt(val, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function setPreviewReady(isReady){
  if (isReady){
    preview.classList.add('is-ready');
    if (previewBox) previewBox.classList.add('is-ready');
    if (previewEmpty) previewEmpty.hidden = true;
  } else {
    preview.classList.remove('is-ready');
    if (previewBox) previewBox.classList.remove('is-ready');
    if (previewEmpty) previewEmpty.hidden = false;
    preview.removeAttribute('src');
  }
}

qualityInput.addEventListener('input', () => {
  qualityLabel.textContent = String(qualityInput.value);
});

// 초기 상태
setPreviewReady(false);
if (previewBox) previewBox.style.aspectRatio = '11 / 8';
setStatus('이미지를 선택해 주세요.');
startBtn.disabled = true;
downloadBtn.disabled = true;

async function loadFile(file){
  if (!file) return;
  if (!file.type.startsWith('image/')){
    alert('이미지 파일만 가능합니다.');
    return;
  }

  selectedFile = file;
  loadedImage = null;
  resetOutput();
  startBtn.disabled = true;

  setStatus('이미지 로딩 중...');
  previewWrap.hidden = false;
  setPreviewReady(false);
  if (previewBox) previewBox.style.aspectRatio = '11 / 8';

  const url = URL.createObjectURL(file);
  preview.src = url;

  origName.textContent = file.name;
  origSize.textContent = `${(file.size/1024).toFixed(1)} KB`;

  const img = new Image();
  img.onload = () => {
    loadedImage = img;

    // 미리보기 박스 비율을 이미지 비율로 맞춤
    if (previewBox) previewBox.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;

    // 기본 입력값: 원본 크기
    widthInput.value = img.naturalWidth;
    heightInput.value = img.naturalHeight;

    setPreviewReady(true);
    startBtn.disabled = false;
    setStatus('준비 완료. 사이즈/확장자 설정 후 Start를 누르세요.');
  };
  img.onerror = () => {
    setPreviewReady(false);
    startBtn.disabled = true;
    setStatus('이미지 로딩 실패. 다른 파일로 시도해 주세요.');
  };
  img.src = url;
}

fileInput.addEventListener('change', (e) => loadFile(e.target.files?.[0]));

// 드롭존: 드래그&드롭
['dragenter','dragover'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault(); e.stopPropagation();
    dropzone.classList.add('dragover');
  });
});
['dragleave','drop'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault(); e.stopPropagation();
    dropzone.classList.remove('dragover');
  });
});
dropzone.addEventListener('drop', (e) => loadFile(e.dataTransfer.files?.[0]));

// 드롭존: 클릭/키보드로 파일 선택 열기
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') fileInput.click();
});

// 기준 축
function getBasisAxis(){
  const checked = document.querySelector('input[name="basisAxis"]:checked');
  return checked ? checked.value : 'width';
}

// 비율 프리셋 버튼 (기준 축 선택 반영)
document.querySelectorAll('.chip[data-ratio]').forEach(btn => {
  btn.addEventListener('click', () => {
    const ratio = btn.getAttribute('data-ratio') || '1:1';
    const [rw, rh] = ratio.split(':').map(v => parseInt(v, 10));
    if (!rw || !rh) return;

    const basis = getBasisAxis();

    if (basis === 'height'){
      // 세로 기준: 세로 입력값(없으면 원본 세로)으로 가로 계산
      const baseH = clampInt(heightInput.value, loadedImage?.naturalHeight || 600);
      const calcW = Math.max(1, Math.round(baseH * rw / rh));
      heightInput.value = baseH;
      widthInput.value = calcW;
    } else {
      // 가로 기준(기본): 가로 입력값(없으면 원본 가로)으로 세로 계산
      const baseW = clampInt(widthInput.value, loadedImage?.naturalWidth || 800);
      const calcH = Math.max(1, Math.round(baseW * rh / rw));
      widthInput.value = baseW;
      heightInput.value = calcH;
    }

    resetOutput();
    if (!startBtn.disabled) setStatus(`비율 ${ratio} 적용 완료. Start를 누르세요.`);
  });
});

// Start: 리사이즈 + 확장자 변환
startBtn.addEventListener('click', async () => {
  if (!selectedFile || !loadedImage){
    alert('이미지를 먼저 선택하세요.');
    return;
  }
  resetOutput();

  const targetW = clampInt(widthInput.value, loadedImage.naturalWidth);
  const targetH = clampInt(heightInput.value, loadedImage.naturalHeight);
  const mime = formatSelect.value;

  canvas.width = targetW;
  canvas.height = targetH;

  ctx.clearRect(0, 0, targetW, targetH);
  ctx.drawImage(loadedImage, 0, 0, targetW, targetH);

  setStatus('변환 중...');

  const q = Math.max(0.3, Math.min(1, Number(qualityInput.value)/100));
  const blob = await new Promise((resolve) => {
    if (mime === 'image/jpeg' || mime === 'image/webp'){
      canvas.toBlob(resolve, mime, q);
    } else {
      canvas.toBlob(resolve, mime);
    }
  });

  if (!blob){
    setStatus('변환 실패. 다른 설정으로 다시 시도해 주세요.');
    return;
  }

  outputBlob = blob;
  outputUrl = URL.createObjectURL(blob);

  downloadBtn.disabled = false;
  const ext = getExtFromMime(mime);
  setStatus(`완료! Download로 .${ext} 파일을 저장하세요.`);
});

// Download
downloadBtn.addEventListener('click', () => {
  if (!outputUrl || !outputBlob) return;

  const ext = getExtFromMime(formatSelect.value);
  const baseName = sanitizeBaseName(selectedFile?.name);
  const filename = `${baseName}_resized.${ext}`;

  const a = document.createElement('a');
  a.href = outputUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
});
