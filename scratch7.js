function testSlots() {
  const startT = 480;
  const endT = 720;
  const bStart = 600; // 10:00
  const bEnd = 630; // 10:30
  
  let preCount = 3;
  let postCount = 2;
  
  const preDuration = Math.round((bStart - startT) / preCount); // (600-480)/3 = 40
  const postDuration = Math.round((endT - bEnd) / postCount); // (720-630)/2 = 45
  
  const fromMins = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const slots = [];
  slots.push({ start: fromMins(startT - 30), end: fromMins(startT), isBreak: true, label: 'Apertura' });
  
  for(let i=0; i<preCount; i++) {
    let sTime = startT + i * preDuration;
    let eTime = (i === preCount - 1) ? bStart : (sTime + preDuration);
    slots.push({ start: fromMins(sTime), end: fromMins(eTime), isBreak: false, label: `${i+1}ra Hora` });
  }
  
  slots.push({ start: fromMins(bStart), end: fromMins(bEnd), isBreak: true, label: 'RECREO' });
  
  for(let i=0; i<postCount; i++) {
    let sTime = bEnd + i * postDuration;
    let eTime = (i === postCount - 1) ? endT : (sTime + postDuration);
    slots.push({ start: fromMins(sTime), end: fromMins(eTime), isBreak: false, label: `${preCount+i+1}ra Hora` });
  }
  
  console.log(slots);
}
testSlots();
