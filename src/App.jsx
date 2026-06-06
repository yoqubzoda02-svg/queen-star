import { useState, useEffect, useRef } from "react";
import * as XLSX from 'xlsx';

const BG='#0A0908',SURF='#131110',CARD='#1A1816',BORD='#2A2520',GOLD='#C9952A',CREAM='#F2EDE4',MUTED='#6A6055',GREEN='#4CB87A',RED='#D95050',BLUE='#4A9ECC',AMBER='#E8963A';
const fmt=(n)=>new Intl.NumberFormat('ru-RU').format(Math.round(n||0));
const todayStr=()=>new Date().toISOString().slice(0,10);
const nowStr=()=>new Date().toISOString();
const shortDate=(iso)=>new Date(iso).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'});
const shortTime=(iso)=>new Date(iso).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
const dayLabel=(iso)=>new Date(iso).toLocaleDateString('ru-RU',{weekday:'short',day:'numeric',month:'short'});

const INIT_PRODUCTS=[
  {id:'КМ',name:'Кроссовки мужские',qty:95,price:120,cost:38,transit:false,reserved:0},
  {id:'ЖЗ',name:'Сапоги зимние жен.',qty:53,price:130,cost:38,transit:false,reserved:0},
  {id:'МЖ-011',name:'Мокасины МЖ (011)',qty:0,price:80,cost:38,transit:true,reserved:0},
  {id:'МЖ-013',name:'Мокасины МЖ (013)',qty:0,price:80,cost:38,transit:true,reserved:0},
  {id:'ЖС',name:'Тапочки ЖС',qty:0,price:65,cost:38,transit:true,reserved:0},
  {id:'ЖБ',name:'Сандалии ЖБ',qty:0,price:90,cost:38,transit:true,reserved:0},
];
const INIT_SETTINGS={usdRate:10.9,cnyRate:1.5,cargoUsd:2.6,markup:3,pin:'1234',lowStock:5};

const S={
  page:{padding:'12px 14px 0'},
  card:{background:CARD,border:`1px solid ${BORD}`,borderRadius:12,padding:14,marginBottom:12},
  label:{fontSize:10,color:MUTED,letterSpacing:1.5,marginBottom:6,textTransform:'uppercase'},
  sec:{fontSize:10,fontWeight:700,color:GOLD,letterSpacing:2.5,marginBottom:12,textTransform:'uppercase'},
  input:{background:SURF,border:`1px solid ${BORD}`,borderRadius:8,padding:'10px 12px',color:CREAM,fontSize:14,width:'100%',outline:'none',boxSizing:'border-box',fontFamily:'inherit'},
  select:{background:SURF,border:`1px solid ${BORD}`,borderRadius:8,padding:'10px 12px',color:CREAM,fontSize:14,width:'100%',outline:'none',boxSizing:'border-box',fontFamily:'inherit'},
  btn:(c=GOLD)=>({background:c,border:'none',borderRadius:8,padding:'12px 18px',color:c===GOLD?'#000':'#fff',fontWeight:700,fontSize:14,cursor:'pointer',width:'100%',fontFamily:'inherit'}),
  btnSm:(c=GOLD)=>({background:c+'22',border:`1px solid ${c}44`,borderRadius:6,padding:'6px 10px',color:c,fontWeight:600,fontSize:12,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}),
  row:{display:'flex',gap:8},
  half:{flex:1},
  li:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`1px solid ${BORD}`},
  div:{borderTop:`1px solid ${BORD}`,margin:'10px 0'},
};

const FR=({label,value,color,bold})=>(
  <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${BORD}`}}>
    <span style={{fontSize:13,color:MUTED}}>{label}</span>
    <span style={{fontSize:13,fontWeight:bold?700:500,color:color||CREAM}}>{value}</span>
  </div>
);
const Badge=({text,color})=>(<span style={{fontSize:10,background:color+'22',color,padding:'2px 7px',borderRadius:4,fontWeight:700,display:'inline-block',marginTop:3}}>{text}</span>);
const StatBox=({label,value,unit,color})=>(
  <div style={{flex:1,background:CARD,border:`1px solid ${BORD}`,borderRadius:12,padding:'12px 14px'}}>
    <div style={S.label}>{label}</div>
    <div style={{display:'flex',alignItems:'baseline',gap:4}}>
      <span style={{fontSize:22,fontWeight:700,color}}>{value}</span>
      <span style={{fontSize:11,color:MUTED}}>{unit}</span>
    </div>
  </div>
);

function LoginScreen({onLogin,ownerPin}){
  const [showPin,setShowPin]=useState(false);
  const [pin,setPin]=useState('');
  const [err,setErr]=useState('');
  const try_=()=>{if(pin===ownerPin)onLogin('owner');else{setErr('Неверный PIN');setPin('');}};
  return(
    <div style={{background:BG,minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:28}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:30,color:GOLD,letterSpacing:4,marginBottom:4}}>QUEEN STAR</div>
      <div style={{fontSize:9,color:MUTED,letterSpacing:4,marginBottom:48}}>ДУШАНБЕ · ТАДЖИКИСТАН</div>
      {!showPin?(
        <>
          <button style={{...S.btn(GOLD),marginBottom:12,borderRadius:12,padding:'16px 24px',fontSize:15}} onClick={()=>setShowPin(true)}>👤 Амир (Владелец)</button>
          <button style={{...S.btn('#2A2420'),borderRadius:12,padding:'16px 24px',fontSize:15,color:CREAM}} onClick={()=>onLogin('employee')}>🏪 Сотрудник</button>
          <div style={{fontSize:11,color:MUTED,marginTop:24,textAlign:'center',lineHeight:1.8}}>Сотрудник: касса и склад<br/>Владелец: полный доступ</div>
        </>
      ):(
        <div style={{width:'100%',maxWidth:280}}>
          <div style={{fontSize:13,color:MUTED,textAlign:'center',marginBottom:14}}>Введите PIN-код</div>
          <input style={{...S.input,textAlign:'center',fontSize:26,letterSpacing:10,marginBottom:10}} type="password" maxLength={6} value={pin} onChange={e=>{setPin(e.target.value);setErr('');}} onKeyDown={e=>{if(e.key==='Enter')try_();}} placeholder="••••" autoFocus/>
          {err&&<div style={{fontSize:12,color:RED,textAlign:'center',marginBottom:8}}>{err}</div>}
          <button style={{...S.btn(GOLD),marginBottom:10}} onClick={try_}>Войти</button>
          <button style={{...S.btn('#2A2420'),color:CREAM,fontSize:13}} onClick={()=>{setShowPin(false);setPin('');setErr('');}}>← Назад</button>
        </div>
      )}
    </div>
  );
}

function LowStockBanner({products,threshold}){
  const low=products.filter(p=>!p.transit&&(p.qty-(p.reserved||0))<threshold&&p.qty>0);
  if(!low.length)return null;
  return(
    <div style={{background:AMBER+'18',borderBottom:`1px solid ${AMBER}44`,padding:'8px 16px',display:'flex',gap:8}}>
      <span style={{fontSize:14}}>⚠️</span>
      <div>
        <div style={{fontSize:11,fontWeight:700,color:AMBER}}>Мало товара</div>
        <div style={{fontSize:10,color:AMBER+'BB'}}>{low.map(p=>`${p.name}: ${p.qty-(p.reserved||0)} пар`).join(' · ')}</div>
      </div>
    </div>
  );
}

function PaymentToggle({value,onChange}){
  return(
    <div style={{display:'flex',background:SURF,borderRadius:8,border:`1px solid ${BORD}`,overflow:'hidden'}}>
      {[{v:'cash',l:'💵 Наличные'},{v:'transfer',l:'📲 Перевод'}].map(opt=>(
        <div key={opt.v} onClick={()=>onChange(opt.v)}
          style={{flex:1,padding:'9px 6px',textAlign:'center',fontSize:13,fontWeight:600,cursor:'pointer',
            background:value===opt.v?GOLD+'22':SURF,color:value===opt.v?GOLD:MUTED,
            borderRight:opt.v==='cash'?`1px solid ${BORD}`:'none',transition:'all 0.15s'}}>
          {opt.l}
        </div>
      ))}
    </div>
  );
}

function Dashboard({todayRevenue,totalStock,monthProfit,annaShare,todaySales,products,settings}){
  const cash=todaySales.filter(s=>s.paymentMethod==='cash').reduce((s,x)=>s+x.total,0);
  const trans=todaySales.filter(s=>s.paymentMethod==='transfer').reduce((s,x)=>s+x.total,0);
  const low=products.filter(p=>!p.transit&&(p.qty-(p.reserved||0))<settings.lowStock&&p.qty>0);
  return(
    <div>
      <div style={{...S.row,marginBottom:10}}>
        <StatBox label="Сегодня" value={fmt(todayRevenue)} unit="сом" color={GREEN}/>
        <StatBox label="Склад (своб.)" value={totalStock} unit="пар" color={GOLD}/>
      </div>
      <div style={{...S.row,marginBottom:14}}>
        <StatBox label="Прибыль мес." value={fmt(monthProfit)} unit="сом" color={monthProfit>=0?GREEN:RED}/>
        <StatBox label="Анна (25%)" value={fmt(annaShare)} unit="сом" color={BLUE}/>
      </div>
      {(cash>0||trans>0)&&(
        <div style={S.card}>
          <div style={S.sec}>Оплата сегодня</div>
          <FR label="💵 Наличные" value={fmt(cash)+' сом'} color={GREEN}/>
          <FR label="📲 Перевод" value={fmt(trans)+' сом'} color={BLUE}/>
        </div>
      )}
      {low.length>0&&(
        <div style={{...S.card,borderColor:AMBER+'55'}}>
          <div style={{...S.sec,color:AMBER}}>⚠ Критичный остаток</div>
          {low.map(p=><FR key={p.id} label={p.name} value={`${p.qty-(p.reserved||0)} пар`} color={AMBER}/>)}
        </div>
      )}
      <div style={S.sec}>Продажи сегодня</div>
      {todaySales.length===0
        ?<div style={{color:MUTED,textAlign:'center',padding:'28px 0',fontSize:13}}>Продаж пока нет</div>
        :todaySales.map(s=>(
          <div key={s.id} style={S.li}>
            <div>
              <div style={{fontSize:13,fontWeight:600}}>{s.name}</div>
              <div style={{fontSize:11,color:MUTED,margin:'2px 0'}}>{shortTime(s.date)} · {s.qty}×{fmt(s.price)} сом</div>
              <Badge text={s.paymentMethod==='cash'?'💵 Наличные':'📲 Перевод'} color={s.paymentMethod==='cash'?GREEN:BLUE}/>
            </div>
            <div style={{fontWeight:700,color:GREEN}}>{fmt(s.total)}</div>
          </div>
        ))
      }
    </div>
  );
}

function Kassa({products,addSale,todaySales}){
  const [prodId,setProdId]=useState('');
  const [qty,setQty]=useState('1');
  const [price,setPrice]=useState('');
  const [note,setNote]=useState('');
  const [payment,setPayment]=useState('cash');
  const [msg,setMsg]=useState('');
  const available=products.filter(p=>!p.transit&&(p.qty-(p.reserved||0))>0);
  const pickProd=(id)=>{setProdId(id);const p=products.find(x=>x.id===id);if(p)setPrice(String(p.price));};
  const submit=()=>{
    if(!prodId||!qty||!price){setMsg('Заполни все поля');return;}
    const p=products.find(x=>x.id===prodId);
    const avail=(p?.qty||0)-(p?.reserved||0);
    if(!p||avail<Number(qty)){setMsg(`Доступно: ${avail} пар`);return;}
    addSale(prodId,qty,price,note,payment);
    setMsg('✓ Записано');setProdId('');setQty('1');setPrice('');setNote('');
    setTimeout(()=>setMsg(''),2500);
  };
  const total=todaySales.reduce((s,x)=>s+x.total,0);
  const cash=todaySales.filter(s=>s.paymentMethod==='cash').reduce((s,x)=>s+x.total,0);
  const trans=todaySales.filter(s=>s.paymentMethod==='transfer').reduce((s,x)=>s+x.total,0);
  return(
    <div>
      <div style={S.card}>
        <div style={S.sec}>Новая продажа</div>
        <div style={{marginBottom:10}}>
          <div style={S.label}>Товар</div>
          <select style={S.select} value={prodId} onChange={e=>pickProd(e.target.value)}>
            <option value="">— Выберите товар —</option>
            {available.map(p=><option key={p.id} value={p.id}>{p.name} (своб: {p.qty-(p.reserved||0)})</option>)}
          </select>
        </div>
        <div style={{...S.row,marginBottom:10}}>
          <div style={S.half}><div style={S.label}>Кол-во</div><input style={S.input} type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)}/></div>
          <div style={S.half}><div style={S.label}>Цена (сом)</div><input style={S.input} type="number" value={price} onChange={e=>setPrice(e.target.value)}/></div>
        </div>
        <div style={{marginBottom:10}}><div style={S.label}>Оплата</div><PaymentToggle value={payment} onChange={setPayment}/></div>
        <div style={{marginBottom:12}}><div style={S.label}>Заметка</div><input style={S.input} value={note} onChange={e=>setNote(e.target.value)} placeholder="Необязательно..."/></div>
        {msg&&<div style={{fontSize:12,color:msg.startsWith('✓')?GREEN:RED,marginBottom:8}}>{msg}</div>}
        <button style={S.btn()} onClick={submit}>Записать продажу</button>
      </div>
      <div style={S.card}>
        <div style={S.sec}>Итого сегодня</div>
        <FR label="💵 Наличные" value={fmt(cash)+' сом'} color={GREEN}/>
        <FR label="📲 Перевод" value={fmt(trans)+' сом'} color={BLUE}/>
        <div style={S.div}/>
        <FR label={`Всего (${todaySales.length} прод.)`} value={fmt(total)+' сом'} bold/>
      </div>
      {todaySales.map(s=>(
        <div key={s.id} style={S.li}>
          <div>
            <div style={{fontSize:13,fontWeight:600}}>{s.name}</div>
            <div style={{fontSize:11,color:MUTED}}>{shortTime(s.date)} · {s.qty}×{fmt(s.price)}</div>
            <Badge text={s.paymentMethod==='cash'?'💵 Нал':'📲 Перев'} color={s.paymentMethod==='cash'?GREEN:BLUE}/>
          </div>
          <div style={{fontWeight:700,color:GREEN}}>{fmt(s.total)}</div>
        </div>
      ))}
    </div>
  );
}

function PhotoUpload({productId,photos,onPhoto}){
  const ref=useRef();
  const handleFile=(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement('canvas');
        const r=Math.min(200/img.width,200/img.height);
        canvas.width=img.width*r;canvas.height=img.height*r;
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        onPhoto(productId,canvas.toDataURL('image/jpeg',0.72));
      };img.src=ev.target.result;
    };reader.readAsDataURL(file);
  };
  const photo=photos[productId];
  return(
    <div onClick={()=>ref.current?.click()} style={{cursor:'pointer',flexShrink:0}}>
      <input ref={ref} type="file" accept="image/*" style={{display:'none'}} onChange={handleFile}/>
      {photo
        ?<img src={photo} alt="" style={{width:50,height:50,borderRadius:8,objectFit:'cover',border:`1px solid ${BORD}`}}/>
        :<div style={{width:50,height:50,borderRadius:8,background:SURF,border:`1px dashed ${BORD}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>📷</div>
      }
    </div>
  );
}

function ProductCard({product,updateProduct,transit,photos,onPhoto,settings}){
  const [editing,setEditing]=useState(false);
  const [val,setVal]=useState(String(product.qty));
  const [showRes,setShowRes]=useState(false);
  const [resVal,setResVal]=useState(String(product.reserved||0));
  const available=product.qty-(product.reserved||0);
  const isLow=!transit&&available<settings.lowStock&&product.qty>0;
  const save=()=>{const n=Number(val);updateProduct(product.id,'qty',n);if(n>0&&transit)updateProduct(product.id,'transit',false);setEditing(false);};
  const saveRes=()=>{updateProduct(product.id,'reserved',Math.min(Number(resVal),product.qty));setShowRes(false);};
  return(
    <div style={{...S.card,borderColor:isLow?AMBER+'55':BORD,opacity:transit?0.72:1}}>
      <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
        <PhotoUpload productId={product.id} photos={photos} onPhoto={onPhoto}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',gap:5,marginBottom:5,flexWrap:'wrap'}}>
            <Badge text={product.id} color={GOLD}/>
            {transit&&<Badge text="В ПУТИ" color={BLUE}/>}
            {isLow&&<Badge text="⚠ МАЛО" color={AMBER}/>}
          </div>
          <div style={{fontSize:14,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{product.name}</div>
          <div style={{fontSize:11,color:MUTED,marginTop:3}}>{fmt(product.price)} сом · себест. {fmt(product.cost)} сом</div>
          {!transit&&(product.reserved||0)>0&&<div style={{fontSize:11,color:AMBER,marginTop:2}}>🔒 Резерв: {product.reserved} · Своб: {available}</div>}
        </div>
        <div style={{textAlign:'right',flexShrink:0}}>
          {editing?(
            <div style={{display:'flex',gap:4,alignItems:'center'}}>
              <input style={{...S.input,width:50,padding:'6px',textAlign:'center',fontSize:16}} type="number" value={val} onChange={e=>setVal(e.target.value)} autoFocus/>
              <button style={S.btnSm(GREEN)} onClick={save}>✓</button>
            </div>
          ):(
            <div onClick={()=>{setVal(String(product.qty));setEditing(true);}} style={{cursor:'pointer'}}>
              <div style={{fontSize:26,fontWeight:700,color:transit?BLUE:isLow?AMBER:CREAM}}>{product.qty}</div>
              <div style={{fontSize:9,color:MUTED}}>всего</div>
            </div>
          )}
        </div>
      </div>
      {!transit&&!editing&&(
        <div style={{...S.row,marginTop:10}}>
          <button style={{...S.btnSm(RED),flex:1}} onClick={()=>updateProduct(product.id,'qty',Math.max(0,product.qty-1))}>−1</button>
          <button style={{...S.btnSm(GREEN),flex:1}} onClick={()=>updateProduct(product.id,'qty',product.qty+1)}>+1</button>
          <button style={{...S.btnSm(AMBER),flex:1}} onClick={()=>{setResVal(String(product.reserved||0));setShowRes(!showRes);}}>🔒</button>
          <button style={{...S.btnSm(MUTED),flex:1}} onClick={()=>{setVal(String(product.qty));setEditing(true);}}>✏</button>
        </div>
      )}
      {showRes&&(
        <div style={{...S.row,marginTop:10,alignItems:'flex-end'}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:AMBER,marginBottom:4}}>Резерв (макс {product.qty})</div>
            <input style={{...S.input,padding:'8px 10px'}} type="number" min="0" max={product.qty} value={resVal} onChange={e=>setResVal(e.target.value)}/>
          </div>
          <button style={S.btnSm(AMBER)} onClick={saveRes}>Ок</button>
          <button style={S.btnSm(MUTED)} onClick={()=>setShowRes(false)}>✕</button>
        </div>
      )}
    </div>
  );
}

function Stock({products,updateProduct,addProduct,photos,onPhoto,role,settings}){
  const [addMode,setAddMode]=useState(false);
  const [np,setNp]=useState({id:'',name:'',qty:'',price:'',cost:'38',transit:false});
  const [msg,setMsg]=useState('');
  const inStock=products.filter(p=>!p.transit);
  const inTransit=products.filter(p=>p.transit);
  const submit=()=>{
    if(!np.id||!np.name||!np.price){setMsg('SKU, название и цена обязательны');return;}
    if(products.find(p=>p.id===np.id)){setMsg(`SKU "${np.id}" уже существует`);return;}
    addProduct({...np,qty:Number(np.qty)||0,price:Number(np.price),cost:Number(np.cost)||38,reserved:0});
    setNp({id:'',name:'',qty:'',price:'',cost:'38',transit:false});setAddMode(false);
  };
  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div style={S.sec}>В наличии ({inStock.reduce((s,p)=>s+p.qty,0)} пар)</div>
        {role==='owner'&&<button style={S.btnSm(addMode?RED:GOLD)} onClick={()=>setAddMode(!addMode)}>{addMode?'✕':'+ Товар'}</button>}
      </div>
      {msg&&<div style={{fontSize:12,color:RED,marginBottom:10}}>{msg}</div>}
      {addMode&&(
        <div style={{...S.card,borderColor:GOLD+'55',marginBottom:16}}>
          <div style={S.sec}>Новый товар</div>
          <div style={{...S.row,marginBottom:8}}>
            <div style={S.half}><div style={S.label}>SKU</div><input style={S.input} value={np.id} onChange={e=>setNp(p=>({...p,id:e.target.value}))} placeholder="ЖЛ"/></div>
            <div style={S.half}><div style={S.label}>Кол-во</div><input style={S.input} type="number" value={np.qty} onChange={e=>setNp(p=>({...p,qty:e.target.value}))} placeholder="0"/></div>
          </div>
          <div style={{marginBottom:8}}><div style={S.label}>Название</div><input style={S.input} value={np.name} onChange={e=>setNp(p=>({...p,name:e.target.value}))} placeholder="Туфли женские"/></div>
          <div style={{...S.row,marginBottom:12}}>
            <div style={S.half}><div style={S.label}>Цена</div><input style={S.input} type="number" value={np.price} onChange={e=>setNp(p=>({...p,price:e.target.value}))} placeholder="120"/></div>
            <div style={S.half}><div style={S.label}>Себест.</div><input style={S.input} type="number" value={np.cost} onChange={e=>setNp(p=>({...p,cost:e.target.value}))} placeholder="38"/></div>
          </div>
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,marginBottom:12,cursor:'pointer',color:CREAM}}>
            <input type="checkbox" checked={np.transit} onChange={e=>setNp(p=>({...p,transit:e.target.checked}))}/>В пути
          </label>
          <button style={S.btn()} onClick={submit}>Добавить товар</button>
        </div>
      )}
      {inStock.map(p=><ProductCard key={p.id} product={p} updateProduct={updateProduct} photos={photos} onPhoto={onPhoto} role={role} settings={settings}/>)}
      {inTransit.length>0&&(
        <>
          <div style={{...S.sec,marginTop:20}}>В пути ({inTransit.length} SKU)</div>
          {inTransit.map(p=><ProductCard key={p.id} product={p} updateProduct={updateProduct} transit photos={photos} onPhoto={onPhoto} role={role} settings={settings}/>)}
        </>
      )}
    </div>
  );
}

function Finance({expenses,addExpense,monthRevenue,monthCOGS,monthExpenses,monthProfit,sales}){
  const [cat,setCat]=useState('');
  const [amount,setAmount]=useState('');
  const [note,setNote]=useState('');
  const [msg,setMsg]=useState('');
  const CATS=['Аренда','Реклама','Доставка','Упаковка','Связь','Прочее'];
  const FIXED=5200;
  const thisMonth=new Date().toISOString().slice(0,7);
  const mS=sales.filter(s=>s.date.startsWith(thisMonth));
  const cashRev=mS.filter(s=>s.paymentMethod==='cash').reduce((s,x)=>s+x.total,0);
  const transRev=mS.filter(s=>s.paymentMethod==='transfer').reduce((s,x)=>s+x.total,0);
  const submit=()=>{
    if(!cat||!amount){setMsg('Заполни поля');return;}
    addExpense(cat,amount,note);setCat('');setAmount('');setNote('');
    setMsg('✓ Добавлено');setTimeout(()=>setMsg(''),2000);
  };
  return(
    <div>
      <div style={S.card}>
        <div style={S.sec}>P&L месяца</div>
        <FR label="Выручка" value={fmt(monthRevenue)+' сом'} color={GREEN}/>
        <FR label="Себестоимость" value={`− ${fmt(monthCOGS)} сом`} color={RED}/>
        <FR label="Зарплата" value={`− ${fmt(FIXED)} сом`} color={RED}/>
        <FR label="Доп. расходы" value={`− ${fmt(monthExpenses)} сом`} color={RED}/>
        <div style={S.div}/>
        <FR label="Чистая прибыль" value={fmt(monthProfit)+' сом'} color={monthProfit>=0?GREEN:RED} bold/>
      </div>
      <div style={S.card}>
        <div style={S.sec}>Наличные vs Перевод</div>
        <FR label="💵 Наличные" value={fmt(cashRev)+' сом'} color={GREEN}/>
        <FR label="📲 Переводы" value={fmt(transRev)+' сом'} color={BLUE}/>
      </div>
      <div style={S.card}>
        <div style={S.sec}>Добавить расход</div>
        <div style={{marginBottom:10}}><div style={S.label}>Категория</div>
          <select style={S.select} value={cat} onChange={e=>setCat(e.target.value)}>
            <option value="">— Выберите —</option>
            {CATS.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{...S.row,marginBottom:12}}>
          <div style={S.half}><div style={S.label}>Сумма</div><input style={S.input} type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="500"/></div>
          <div style={S.half}><div style={S.label}>Заметка</div><input style={S.input} value={note} onChange={e=>setNote(e.target.value)} placeholder="..."/></div>
        </div>
        {msg&&<div style={{fontSize:12,color:msg.startsWith('✓')?GREEN:RED,marginBottom:8}}>{msg}</div>}
        <button style={S.btn(RED)} onClick={submit}>Добавить расход</button>
      </div>
      {expenses.filter(e=>e.date.startsWith(new Date().toISOString().slice(0,7))).map(e=>(
        <div key={e.id} style={S.li}>
          <div><div style={{fontSize:13,fontWeight:600}}>{e.category}</div><div style={{fontSize:11,color:MUTED}}>{shortDate(e.date)}{e.note?' · '+e.note:''}</div></div>
          <div style={{fontWeight:700,color:RED}}>− {fmt(e.amount)}</div>
        </div>
      ))}
    </div>
  );
}

function History({sales,onBack}){
  const [filter,setFilter]=useState('all');
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7));
  const months=[...new Set(sales.map(s=>s.date.slice(0,7)))].sort().reverse();
  const filtered=sales.filter(s=>s.date.startsWith(month)).filter(s=>filter==='all'||s.paymentMethod===filter);
  const byDay=filtered.reduce((acc,s)=>{const d=s.date.slice(0,10);if(!acc[d])acc[d]=[];acc[d].push(s);return acc;},{});
  const days=Object.keys(byDay).sort().reverse();
  const total=filtered.reduce((s,x)=>s+x.total,0);
  const cash=filtered.filter(s=>s.paymentMethod==='cash').reduce((s,x)=>s+x.total,0);
  const trans=filtered.filter(s=>s.paymentMethod==='transfer').reduce((s,x)=>s+x.total,0);
  return(
    <div>
      {onBack&&<button style={{...S.btnSm(MUTED),marginBottom:12}} onClick={onBack}>← Назад</button>}
      <div style={{...S.row,marginBottom:12}}>
        <select style={{...S.select,flex:2}} value={month} onChange={e=>setMonth(e.target.value)}>
          {months.length===0&&<option value={month}>{month}</option>}
          {months.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        <select style={{...S.select,flex:1.5}} value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">Все</option>
          <option value="cash">Наличные</option>
          <option value="transfer">Перевод</option>
        </select>
      </div>
      {filtered.length>0&&(
        <div style={S.card}>
          <FR label="💵 Наличные" value={fmt(cash)+' сом'} color={GREEN}/>
          <FR label="📲 Переводы" value={fmt(trans)+' сом'} color={BLUE}/>
          <div style={S.div}/>
          <FR label={`Итого (${filtered.length} прод.)`} value={fmt(total)+' сом'} bold/>
        </div>
      )}
      {days.length===0
        ?<div style={{color:MUTED,textAlign:'center',padding:'32px 0',fontSize:13}}>Продаж нет</div>
        :days.map(day=>(
          <div key={day}>
            <div style={{fontSize:11,color:GOLD,letterSpacing:1,margin:'14px 0 8px',fontWeight:700}}>{dayLabel(day+'T12:00:00')} — {fmt(byDay[day].reduce((s,x)=>s+x.total,0))} сом</div>
            {byDay[day].map(s=>(
              <div key={s.id} style={S.li}>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{s.name}</div>
                  <div style={{fontSize:11,color:MUTED}}>{shortTime(s.date)} · {s.qty}×{fmt(s.price)}</div>
                  <Badge text={s.paymentMethod==='cash'?'💵 Нал':'📲 Перев'} color={s.paymentMethod==='cash'?GREEN:BLUE}/>
                </div>
                <div style={{fontWeight:700,color:GREEN}}>{fmt(s.total)}</div>
              </div>
            ))}
          </div>
        ))
      }
    </div>
  );
}

function Calc({settings,setSettings}){
  const [cny,setCny]=useState('');
  const [weight,setWeight]=useState('0.9');
  const [result,setResult]=useState(null);
  const calc=()=>{
    const p=Number(cny),w=Number(weight);if(!p||!w)return;
    const buy=p*settings.cnyRate,cargo=w*settings.cargoUsd*settings.usdRate,cost=buy+cargo,retail=cost*settings.markup,withDel=retail+30;
    setResult({buy,cargo,cost,retail,withDel,profit:retail-cost,margin:((retail-cost)/retail*100).toFixed(0)});
  };
  return(
    <div>
      <div style={S.card}>
        <div style={S.sec}>Расчёт цены</div>
        <div style={{...S.row,marginBottom:12}}>
          <div style={S.half}><div style={S.label}>Закупка (¥)</div><input style={S.input} type="number" value={cny} onChange={e=>setCny(e.target.value)} placeholder="10"/></div>
          <div style={S.half}><div style={S.label}>Вес (кг)</div><input style={S.input} type="number" step="0.1" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="0.9"/></div>
        </div>
        <button style={S.btn()} onClick={calc}>Рассчитать →</button>
      </div>
      {result&&(
        <div style={{...S.card,borderColor:GOLD+'44'}}>
          <FR label="Закупка в сомони" value={fmt(result.buy)+' сом'}/>
          <FR label={`Карго ($${settings.cargoUsd}/кг·${weight}кг)`} value={fmt(result.cargo)+' сом'}/>
          <div style={S.div}/>
          <FR label="Себестоимость" value={fmt(result.cost)+' сом'} bold/>
          <div style={{height:8}}/>
          <FR label={`Розница (×${settings.markup})`} value={fmt(result.retail)+' сом'} color={GOLD} bold/>
          <FR label="С доставкой (+30)" value={fmt(result.withDel)+' сом'} color={GOLD}/>
          <div style={S.div}/>
          <FR label="Прибыль с пары" value={fmt(result.profit)+' сом'} color={GREEN} bold/>
          <FR label="Маржа" value={result.margin+'%'} color={GREEN}/>
        </div>
      )}
      <div style={S.card}>
        <div style={S.sec}>Курсы</div>
        <div style={{...S.row,marginBottom:10}}>
          <div style={S.half}><div style={S.label}>1$ = сом</div><input style={S.input} type="number" step="0.1" value={settings.usdRate} onChange={e=>setSettings(p=>({...p,usdRate:Number(e.target.value)}))}/></div>
          <div style={S.half}><div style={S.label}>1¥ = сом</div><input style={S.input} type="number" step="0.01" value={settings.cnyRate} onChange={e=>setSettings(p=>({...p,cnyRate:Number(e.target.value)}))}/></div>
        </div>
        <div style={S.row}>
          <div style={S.half}><div style={S.label}>Карго ($/кг)</div><input style={S.input} type="number" step="0.1" value={settings.cargoUsd} onChange={e=>setSettings(p=>({...p,cargoUsd:Number(e.target.value)}))}/></div>
          <div style={S.half}><div style={S.label}>Наценка (×)</div><input style={S.input} type="number" step="0.5" value={settings.markup} onChange={e=>setSettings(p=>({...p,markup:Number(e.target.value)}))}/></div>
        </div>
      </div>
    </div>
  );
}

function More({sales,expenses,products,monthRevenue,monthCOGS,monthExpenses,monthProfit,annaShare,settings,setSettings,onLogout}){
  const [view,setView]=useState(null);
  const FIXED=5200;
  if(view==='history')return <History sales={sales} onBack={()=>setView(null)}/>;
  if(view==='investor')return(
    <div>
      <button style={{...S.btnSm(MUTED),marginBottom:12}} onClick={()=>setView(null)}>← Назад</button>
      <div style={{...S.card,borderColor:BLUE+'44'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
          <div style={{width:46,height:46,borderRadius:'50%',background:BLUE+'22',border:`1px solid ${BLUE}44`,display:'flex',alignItems:'center',justifyContent:'center',color:BLUE,fontWeight:700,fontSize:18}}>А</div>
          <div><div style={{fontWeight:700,fontSize:15}}>Анна Порошина</div><div style={{fontSize:11,color:BLUE,marginTop:2}}>Инвестор · 25% прибыли · ₽100 000</div></div>
        </div>
        <FR label="Выручка" value={fmt(monthRevenue)+' сом'} color={GREEN}/>
        <FR label="Все расходы" value={`− ${fmt(monthCOGS+monthExpenses+FIXED)} сом`} color={RED}/>
        <div style={S.div}/>
        <FR label="Чистая прибыль" value={fmt(monthProfit)+' сом'} color={monthProfit>=0?GREEN:RED} bold/>
        <div style={{background:BLUE+'11',border:`1px solid ${BLUE}33`,borderRadius:12,padding:16,marginTop:14,textAlign:'center'}}>
          <div style={{fontSize:9,color:BLUE,letterSpacing:3,marginBottom:6}}>К ВЫПЛАТЕ АННЕ (25%)</div>
          <div style={{fontSize:38,fontWeight:700,color:BLUE}}>{fmt(annaShare)}</div>
          <div style={{fontSize:12,color:MUTED}}>сомони</div>
        </div>
      </div>
    </div>
  );
  if(view==='export'){
    const doExport=()=>{
      try{
        const wb=XLSX.utils.book_new();
        const sd=sales.map(s=>({'Дата':new Date(s.date).toLocaleDateString('ru-RU'),'Время':shortTime(s.date),'Товар':s.name,'SKU':s.productId,'Кол-во':s.qty,'Цена':s.price,'Итого':s.total,'Оплата':s.paymentMethod==='cash'?'Наличные':'Перевод','Заметка':s.note||''}));
        XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(sd.length?sd:[{}]),'Продажи');
        const pd=products.map(p=>({'SKU':p.id,'Название':p.name,'Кол-во':p.qty,'Резерв':p.reserved||0,'Доступно':p.qty-(p.reserved||0),'Цена':p.price,'Себест.':p.cost,'Статус':p.transit?'В пути':'В наличии'}));
        XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(pd),'Склад');
        const ed=expenses.map(e=>({'Дата':new Date(e.date).toLocaleDateString('ru-RU'),'Категория':e.category,'Сумма':e.amount,'Заметка':e.note||''}));
        XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(ed.length?ed:[{}]),'Расходы');
        XLSX.writeFile(wb,`queen-star-${new Date().toLocaleDateString('ru-RU').replace(/\./g,'-')}.xlsx`);
      }catch(e){alert('Ошибка: '+e.message);}
    };
    return(
      <div>
        <button style={{...S.btnSm(MUTED),marginBottom:12}} onClick={()=>setView(null)}>← Назад</button>
        <div style={S.card}>
          <div style={S.sec}>Экспорт в Excel</div>
          <div style={{fontSize:13,color:MUTED,marginBottom:14,lineHeight:1.7}}>Один файл, 3 листа:<br/>📋 Продажи · 📦 Склад · 💸 Расходы</div>
          <FR label="Продаж" value={sales.length}/><FR label="Расходов" value={expenses.length}/><FR label="SKU" value={products.length}/>
          <div style={{height:14}}/>
          <button style={S.btn(GREEN)} onClick={doExport}>📊 Скачать Excel</button>
        </div>
      </div>
    );
  }
  if(view==='settings')return(
    <div>
      <button style={{...S.btnSm(MUTED),marginBottom:12}} onClick={()=>setView(null)}>← Назад</button>
      <div style={S.card}>
        <div style={S.sec}>Порог мало товара</div>
        <div style={S.label}>Уведомление при остатке меньше (пар)</div>
        <input style={S.input} type="number" min="1" max="20" value={settings.lowStock} onChange={e=>setSettings(p=>({...p,lowStock:Number(e.target.value)||5}))}/>
      </div>
      <div style={S.card}>
        <div style={S.sec}>Сменить PIN</div>
        <PinChange settings={settings} setSettings={setSettings}/>
      </div>
    </div>
  );
  const items=[
    {id:'history',icon:'📋',label:'История продаж',sub:'По месяцам, наличные/переводы'},
    {id:'investor',icon:'💼',label:'Инвестор',sub:'Расчёт доли Анны (25%)'},
    {id:'export',icon:'📊',label:'Экспорт Excel',sub:'Продажи + склад + расходы'},
    {id:'settings',icon:'⚙️',label:'Настройки',sub:'PIN, порог остатка'},
  ];
  return(
    <div>
      <div style={S.sec}>Дополнительно</div>
      {items.map(item=>(
        <div key={item.id} style={{...S.card,cursor:'pointer',display:'flex',alignItems:'center',gap:14}} onClick={()=>setView(item.id)}>
          <div style={{fontSize:28}}>{item.icon}</div>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{item.label}</div><div style={{fontSize:11,color:MUTED,marginTop:2}}>{item.sub}</div></div>
          <div style={{color:MUTED,fontSize:18}}>›</div>
        </div>
      ))}
      <div style={{marginTop:16}}><button style={{...S.btn('#2A2420'),color:RED,fontSize:13}} onClick={onLogout}>← Выйти</button></div>
    </div>
  );
}

function PinChange({settings,setSettings}){
  const [newPin,setNewPin]=useState('');
  const [conf,setConf]=useState('');
  const [msg,setMsg]=useState('');
  const change=()=>{
    if(newPin.length<4){setMsg('Минимум 4 символа');return;}
    if(newPin!==conf){setMsg('PIN не совпадает');return;}
    setSettings(p=>({...p,pin:newPin}));setNewPin('');setConf('');
    setMsg('✓ PIN изменён');setTimeout(()=>setMsg(''),2000);
  };
  return(
    <>
      <div style={{marginBottom:10}}><div style={S.label}>Новый PIN</div><input style={S.input} type="password" value={newPin} onChange={e=>setNewPin(e.target.value)} placeholder="Мин. 4 символа"/></div>
      <div style={{marginBottom:12}}><div style={S.label}>Повторите</div><input style={S.input} type="password" value={conf} onChange={e=>setConf(e.target.value)} placeholder="Повторите PIN"/></div>
      {msg&&<div style={{fontSize:12,color:msg.startsWith('✓')?GREEN:RED,marginBottom:8}}>{msg}</div>}
      <button style={S.btn(GOLD)} onClick={change}>Сохранить PIN</button>
    </>
  );
}

export default function QueenStar(){
  const [role,setRole]=useState(null);
  const [tab,setTab]=useState('dash');
  const [products,setProducts]=useState(INIT_PRODUCTS);
  const [sales,setSales]=useState([]);
  const [expenses,setExpenses]=useState([]);
  const [settings,setSettings]=useState(INIT_SETTINGS);
  const [photos,setPhotos]=useState({});
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const load=(key,def)=>{try{const v=localStorage.getItem(key);return v?JSON.parse(v):def;}catch{return def;}};
        setProducts(load('qs_products',INIT_PRODUCTS));
        setSales(load('qs_sales',[]));
        setExpenses(load('qs_expenses',[]));
        setSettings(load('qs_settings',INIT_SETTINGS));
        setPhotos(load('qs_photos',{}));
      }catch{}
      setReady(true);
    })();
  },[]);

  useEffect(()=>{if(ready)try{localStorage.setItem('qs_products',JSON.stringify(products));}catch{}},[products,ready]);
  useEffect(()=>{if(ready)try{localStorage.setItem('qs_sales',JSON.stringify(sales));}catch{}},[sales,ready]);
  useEffect(()=>{if(ready)try{localStorage.setItem('qs_expenses',JSON.stringify(expenses));}catch{}},[expenses,ready]);
  useEffect(()=>{if(ready)try{localStorage.setItem('qs_settings',JSON.stringify(settings));}catch{}},[settings,ready]);
  useEffect(()=>{if(ready)try{localStorage.setItem('qs_photos',JSON.stringify(photos));}catch{}},[photos,ready]);

  const todaySales=sales.filter(s=>s.date.startsWith(todayStr()));
  const todayRevenue=todaySales.reduce((s,x)=>s+x.total,0);
  const totalStock=products.filter(p=>!p.transit).reduce((s,p)=>s+(p.qty-(p.reserved||0)),0);
  const thisMonth=new Date().toISOString().slice(0,7);
  const mS=sales.filter(s=>s.date.startsWith(thisMonth));
  const monthRevenue=mS.reduce((s,x)=>s+x.total,0);
  const monthCOGS=mS.reduce((s,x)=>s+x.cost*x.qty,0);
  const monthExpenses=expenses.filter(e=>e.date.startsWith(thisMonth)).reduce((s,e)=>s+e.amount,0);
  const monthProfit=monthRevenue-monthCOGS-monthExpenses-5200;
  const annaShare=Math.max(0,monthProfit*0.25);

  const addSale=(productId,qty,price,note,paymentMethod)=>{
    const product=products.find(p=>p.id===productId);if(!product)return;
    setSales(prev=>[{id:Date.now(),productId,name:product.name,qty:Number(qty),price:Number(price),cost:product.cost,total:Number(qty)*Number(price),date:nowStr(),note,paymentMethod},...prev]);
    setProducts(prev=>prev.map(p=>p.id===productId?{...p,qty:p.qty-Number(qty)}:p));
  };
  const addExpense=(cat,amount,note)=>setExpenses(prev=>[{id:Date.now(),category:cat,amount:Number(amount),date:nowStr(),note},...prev]);
  const updateProduct=(id,field,value)=>setProducts(prev=>prev.map(p=>p.id===id?{...p,[field]:value}:p));
  const addProduct=(prod)=>setProducts(prev=>[...prev,prod]);
  const onPhoto=(pid,data)=>setPhotos(prev=>({...prev,[pid]:data}));

  const OWNER_TABS=[{id:'dash',icon:'⬡',label:'Главная'},{id:'kassa',icon:'◎',label:'Касса'},{id:'stock',icon:'▦',label:'Склад'},{id:'finance',icon:'◈',label:'Финансы'},{id:'calc',icon:'◉',label:'Цены'},{id:'more',icon:'☰',label:'Ещё'}];
  const EMP_TABS=[{id:'dash',icon:'⬡',label:'Главная'},{id:'kassa',icon:'◎',label:'Касса'},{id:'stock',icon:'▦',label:'Склад'}];
  const TABS=role==='owner'?OWNER_TABS:EMP_TABS;
  const fin={monthRevenue,monthCOGS,monthExpenses,monthProfit,annaShare};
  const shared={products,updateProduct,addProduct};

  if(!ready)return(
    <div style={{background:BG,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:GOLD,fontSize:22,letterSpacing:4}}>QUEEN STAR</div>
    </div>
  );

  if(!role)return(
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}`}</style>
      <LoginScreen onLogin={r=>{setRole(r);setTab('dash');}} ownerPin={settings.pin}/>
    </>
  );

  return(
    <div style={{background:BG,minHeight:'100vh',color:CREAM,fontFamily:"'DM Sans',sans-serif",paddingBottom:76}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,600;9..40,700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}input::placeholder{color:#3A3530;}input:focus,select:focus{border-color:${GOLD}!important;}select option{background:#1A1816;color:${CREAM};}input[type=number]::-webkit-inner-spin-button{opacity:0.3;}::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:${BORD};}`}</style>

      <div style={{background:SURF,borderBottom:`1px solid ${BORD}`,padding:'12px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:50}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:19,color:GOLD,letterSpacing:3}}>QUEEN STAR</div>
          <div style={{fontSize:8,color:MUTED,letterSpacing:3,marginTop:1}}>ДУШАНБЕ · ТАДЖИКИСТАН</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:11,color:role==='owner'?GOLD:MUTED,fontWeight:600}}>{role==='owner'?'👤 Амир':'🏪 Сотрудник'}</div>
          <div style={{fontSize:10,color:GREEN,marginTop:2}}>● Онлайн</div>
        </div>
      </div>

      <LowStockBanner products={products} threshold={settings.lowStock}/>

      <div style={S.page}>
        {tab==='dash'&&<Dashboard {...{todayRevenue,totalStock,todaySales,products,settings,...fin}}/>}
        {tab==='kassa'&&<Kassa {...{...shared,addSale,todaySales,role}}/>}
        {tab==='stock'&&<Stock {...{...shared,photos,onPhoto,role,settings}}/>}
        {tab==='finance'&&role==='owner'&&<Finance {...{expenses,addExpense,sales,...fin}}/>}
        {tab==='calc'&&role==='owner'&&<Calc {...{settings,setSettings}}/>}
        {tab==='more'&&role==='owner'&&<More {...{sales,expenses,...shared,...fin,settings,setSettings,onLogout:()=>setRole(null)}}/>}
      </div>

      <nav style={{position:'fixed',bottom:0,left:0,right:0,background:SURF,borderTop:`1px solid ${BORD}`,display:'flex',zIndex:100}}>
        {TABS.map(t=>(
          <div key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,padding:'9px 2px 8px',textAlign:'center',cursor:'pointer',color:tab===t.id?GOLD:MUTED,transition:'color 0.2s',userSelect:'none',position:'relative'}}>
            {tab===t.id&&<div style={{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',width:22,height:2,background:GOLD,borderRadius:'0 0 2px 2px'}}/>}
            <div style={{fontSize:16,lineHeight:1,marginBottom:3}}>{t.icon}</div>
            <div style={{fontSize:8,letterSpacing:0.5,fontWeight:tab===t.id?700:400}}>{t.label}</div>
          </div>
        ))}
      </nav>
    </div>
  );
}
