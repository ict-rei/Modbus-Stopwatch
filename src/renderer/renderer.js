const logo = document.getElementById("logo");
const info = document.getElementById("info-tooltip");

logo.addEventListener("click", (e) => {
  const url = e.getAttribute("data-url");
  window.electronAPI.openExternal(url);
});

window.electronAPI.firstStart((_event, isFirst) => {
  if (isFirst) {
    setTimeout(() => {
      info.classList.toggle("tooltip-open");
    }, 500);
    setTimeout(() => {
      info.classList.toggle("tooltip-open");
    }, 5000);
  }
});

onload = () => {};
