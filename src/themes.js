// One catalog shared by storage validation, the native window and Theme Studio.
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.elysiumThemes = factory();
})(typeof window === 'object' ? window : globalThis, function() {
  const legacy = [
    ['midnight','Electric Midnight','city'], ['violet','Violet Horizon','team'], ['slate','Quiet Navy','city'],
    ['rose','Rose Neon','rose'], ['aurora','Aurora Glass','aurora'], ['solar','Solar Drift','solar'],
    ['crimson','Crimson Circuit','crimson'], ['emerald','Emerald Grid','emerald'], ['cosmic','Cosmic Archive','cosmic'],
    ['aqua','Aqua Horizon','aqua'], ['lunar','Lunar Station','lunar'], ['silver','Silver Fog','silver'],
  ];
  function palette(mode, canvas, surface, raised, input, text, muted, accent, focus, line) {
    return { mode, canvas, surface, raised, input, text, muted, accent, focus, line, onAccent:'#ffffff',
      danger: mode === 'light' ? '#a32d46' : '#ffadb9',
      success: mode === 'light' ? '#146440' : '#89d8b0' };
  }
  const novel = [
    {id:'roseglass',name:'Rose Glass',title:'เมืองกระจกสีชมพู',character:'cherry',description:'ฝนบาง ๆ แสงเมือง และช่วงพักของ Cherry',
      palette:palette('dark','#1b101b','#291a28','#392636','#160d16','#fff1f7','#d5b5c8','#a83f72','#f2a7d1','#755468')},
    {id:'starlibrary',name:'Stellar Library',title:'ห้องสมุดดวงดาว',character:'violet',description:'อ่านไปกับ Violet ใต้เพดานแห่งดวงดาว',
      palette:palette('dark','#141024','#211b36','#302745','#100c1c','#f6f0ff','#c5b8df','#7150b8','#cdb0ff','#706185')},
    {id:'titanwater',name:'Titan Sanctuary',title:'ทะเลไททัน',character:'cherry',description:'พักสายตาในแสงสีฟ้าของสถานีใต้ทะเล',
      palette:palette('dark','#071b1e','#102b2d','#1b3b3d','#051619','#e7fcf6','#a6cccb','#187776','#71ded0','#477d80')},
    {id:'sunrail',name:'Last Light Express',title:'สถานีแสงสุดท้าย',character:'ghost',description:'Ghost กับสมุดบันทึกและรถไฟยามเย็น',
      palette:palette('dark','#211710','#30231b','#433025','#19110c','#fff3e3','#d8bfa7','#a75b2b','#efbb79','#866d55')},
    {id:'jadeatelier',name:'Jade Atelier',title:'ห้องทดลองสีหยก',character:'violet',description:'พื้นที่สว่างสำหรับประกอบไอเดียใหม่',
      palette:palette('light','#edf5f0','#fbfdfb','#dcece3','#ffffff','#193f32','#496558','#216b50','#23674c','#8aa69a')},
    {id:'ivoryorbit',name:'Ivory Orbit',title:'วงโคจรสีงาช้าง',character:'nova',description:'ความเงียบของดวงจันทร์ในมุมมองของ Nova',
      palette:palette('light','#f2f1ed','#fdfcf9','#e4e5e3','#ffffff','#2c3542','#606671','#4e657f','#3d5a80','#9aa3ae')},
    {id:'emberforge',name:'Ember Workshop',title:'โรงงานแสงอำพัน',character:'ghost',description:'กลไกทองเหลืองและแสงอุ่นในห้องทำงาน',
      palette:palette('dark','#1d1511','#2b211a','#3e2e23','#160f0b','#fff1df','#d4bca4','#a65a26','#f7b96d','#826950')},
    {id:'lilacdream',name:'Lilac Observatory',title:'หอดูดาวม่วงอ่อน',character:'violet',description:'เช้าที่นุ่มนวลในหอดูดาวของ Violet',
      palette:palette('light','#f2eef8','#fdfaff','#e8def2','#ffffff','#3b2b4e','#6d5b7c','#77518f','#714292','#a896b8')},
    {id:'cobaltflight',name:'Cobalt Skyport',title:'ท่าอากาศสีคราม',character:'cherry',description:'เปิดโลกเหนือเมฆไปกับ Cherry',
      palette:palette('dark','#08162d','#102444','#1b3356','#061024','#eef5ff','#abc2e6','#315dc0','#8bbfff','#56749c')},
    {id:'midnightmono',name:'Graphite Snow',title:'คืนหิมะกราไฟต์',character:'ghost',description:'สีที่สงบและแสงหิมะบนหอดูดาว',
      palette:palette('dark','#151719','#22262a','#32373c','#0e1114','#f1f3f4','#bfc6cc','#52677b','#b6cadb','#737c85')},
    {id:'scarletpulse',name:'Scarlet Signal',title:'สัญญาณสีชาด',character:'nova',description:'Nova ฟังสัญญาณท่ามกลางแสงสีชาด',
      palette:palette('dark','#200e17','#321821','#482331','#180a11','#fff0f3','#dcb5bf','#b43b58','#ffa0b4','#875965')},
    {id:'honeycloud',name:'Honey Cloud',title:'เช้าเหนือเมฆ',character:'cherry',description:'สมุดหนึ่งเล่มกับแสงแรกของเมืองลอยฟ้า',
      palette:palette('light','#faf2e4','#fffcf6','#f1e3cb','#ffffff','#49351d','#756043','#906018','#835415','#bba384')},
  ];
  const byId = Object.fromEntries(novel.map(theme => [theme.id, theme]));
  const ids = novel.map(theme => theme.id);
  const catalog = [...legacy, ...novel.map(theme => [theme.id, theme.name, theme.id])];
  function get(id) { return Object.hasOwn(byId, id) ? byId[id] : null; }
  return { legacy, novel, ids, catalog, get };
});
