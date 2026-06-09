import { useState, useEffect, useRef } from "react";
import * as XLSX from 'xlsx';
import { db, auth } from './firebase.js';
import { doc, setDoc, onSnapshot, collection, addDoc, query, orderBy, getDoc } from 'firebase/firestore';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

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


// ── ВХОД СОТРУДНИКА (SMS) ─────────────────────────────────────
function EmployeeLogin({onLogin}){
  const [step,setStep]=useState('phone');
  const [phone,setPhone]=useState('+992');
  const [code,setCode]=useState('');
  const [name,setName]=useState('');
  const [confirm,setConfirm]=useState(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState('');
  const rcRef=useRef();

  const sendSMS=async()=>{
    if(phone.length<8){setErr('Введи полный номер');return;}
    setLoading(true);setErr('');
    try{
      if(!rcRef.current){
        rcRef.current=new RecaptchaVerifier(auth,'rc-container',{size:'invisible'});
      }
      const result=await signInWithPhoneNumber(auth,phone,rcRef.current);
      setConfirm(result);setStep('code');
    }catch(e){
      setErr('Ошибка: проверь номер');
      rcRef.current=null;
    }
    setLoading(false);
  };

  const verifyCode=async()=>{
    if(!code||!confirm)return;
    setLoading(true);setErr('');
    try{
      const cred=await confirm.confirm(code);
      const uid=cred.user.uid;
      const snap=await getDoc(doc(db,'employees',uid));
      if(snap.exists()&&snap.data().name){
        onLogin({uid,name:snap.data().name,phone});
      }else{
        setStep('name');
      }
    }catch(e){setErr('Неверный код');}
    setLoading(false);
  };

  const saveName=async()=>{
    if(!name.trim()||!auth.currentUser)return;
    const uid=auth.currentUser.uid;
    await setDoc(doc(db,'employees',uid),{name:name.trim(),phone,registered:Date.now()});
    onLogin({uid,name:name.trim(),phone});
  };

  return(
    <div style={{width:'100%',maxWidth:300}}>
      <div id="rc-container"/>
      {step==='phone'&&(
        <>
          <div style={{fontSize:13,color:MUTED,textAlign:'center',marginBottom:16}}>Введи свой номер телефона</div>
          <input style={{...S.input,marginBottom:10,textAlign:'center',fontSize:16,letterSpacing:1}} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+992 900 123456"/>
          {err&&<div style={{fontSize:12,color:RED,marginBottom:8,textAlign:'center'}}>{err}</div>}
          <button style={{...S.btn('#2A2420'),color:CREAM,fontFamily:'inherit'}} onClick={sendSMS} disabled={loading}>{loading?'Отправка...':'📱 Получить SMS код'}</button>
        </>
      )}
      {step==='code'&&(
        <>
          <div style={{fontSize:13,color:MUTED,textAlign:'center',marginBottom:4}}>Код отправлен на</div>
          <div style={{fontSize:15,color:GOLD,textAlign:'center',marginBottom:16,fontWeight:700}}>{phone}</div>
          <input style={{...S.input,marginBottom:10,textAlign:'center',fontSize:24,letterSpacing:10}} type="number" value={code} onChange={e=>setCode(e.target.value)} placeholder="000000" autoFocus/>
          {err&&<div style={{fontSize:12,color:RED,marginBottom:8,textAlign:'center'}}>{err}</div>}
          <button style={{...S.btn('#2A2420'),color:CREAM,marginBottom:8,fontFamily:'inherit'}} onClick={verifyCode} disabled={loading}>{loading?'Проверка...':'Подтвердить →'}</button>
          <button style={{...S.btnSm(MUTED),width:'100%',textAlign:'center'}} onClick={()=>{setStep('phone');setCode('');setErr('');}}>← Изменить номер</button>
        </>
      )}
      {step==='name'&&(
        <>
          <div style={{fontSize:13,color:MUTED,textAlign:'center',marginBottom:16}}>Как тебя зовут?<br/><span style={{fontSize:11}}>Это имя будет видно владельцу</span></div>
          <input style={{...S.input,marginBottom:12,textAlign:'center',fontSize:16}} value={name} onChange={e=>setName(e.target.value)} placeholder="Твоё имя" autoFocus/>
          {err&&<div style={{fontSize:12,color:RED,marginBottom:8,textAlign:'center'}}>{err}</div>}
          <button style={S.btn()} onClick={saveName} disabled={!name.trim()}>Начать смену →</button>
        </>
      )}
    </div>
  );
}

function EmployeePhoneLogin({onLogin}){
  const [step,setStep]=useState('phone');
  const [phone,setPhone]=useState('+992');
  const [code,setCode]=useState('');
  const [name,setName]=useState('');
  const [conf,setConf]=useState(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState('');
  const rcRef=useRef(null);

  const sendSMS=async()=>{
    if(phone.length<10){setErr('Введи полный номер');return;}
    setLoading(true);setErr('');
    try{
      if(!rcRef.current){rcRef.current=new RecaptchaVerifier(auth,'rc-container',{size:'invisible'});}
      const result=await signInWithPhoneNumber(auth,phone,rcRef.current);
      setConf(result);setStep('code');
    }catch(e){
      const code = e.code || '';
      if(code==='auth/invalid-phone-number') setErr('Неверный формат номера (+992...)');
      else if(code==='auth/too-many-requests') setErr('Слишком много попыток. Подожди 1 час');
      else if(code==='auth/operation-not-allowed') setErr('SMS не включён в Firebase. Включи Phone Auth');
      else if(code==='auth/app-not-authorized') setErr('Домен не авторизован в Firebase');
      else if(code==='auth/captcha-check-failed') setErr('Ошибка reCAPTCHA. Обнови страницу');
      else setErr('Ошибка: ' + (code || e.message || 'неизвестна'));
      rcRef.current=null;
    }
    setLoading(false);
  };

  const verifyCode=async()=>{
    if(code.length<6){setErr('Введи 6-значный код');return;}
    setLoading(true);setErr('');
    try{
      await conf.confirm(code);
      const empId=phone.replace(/\D/g,'');
      const snap=await getDoc(doc(db,'employees',empId));
      if(snap.exists()){
        const emp=snap.data();
        await setDoc(doc(db,'shifts',`${empId}_${Date.now()}`),{employeeId:empId,employeeName:emp.name,phone,startTime:Date.now(),date:new Date().toISOString().slice(0,10)});
        onLogin('employee',{name:emp.name,phone,id:empId});
      }else{setStep('name');}
    }catch(e){setErr('Неверный код. Попробуй снова');}
    setLoading(false);
  };

  const saveName=async()=>{
    if(!name.trim()){setErr('Введи имя');return;}
    setLoading(true);
    try{
      const empId=phone.replace(/\D/g,'');
      await setDoc(doc(db,'employees',empId),{name:name.trim(),phone,createdAt:Date.now()});
      await setDoc(doc(db,'shifts',`${empId}_${Date.now()}`),{employeeId:empId,employeeName:name.trim(),phone,startTime:Date.now(),date:new Date().toISOString().slice(0,10)});
      onLogin('employee',{name:name.trim(),phone,id:empId});
    }catch(e){setErr('Ошибка: '+e.message);}
    setLoading(false);
  };

  return(
    <div style={{width:'100%',maxWidth:300}}>
      <div id="rc-container"/>
      {step==='phone'&&(
        <>
          <div style={{fontSize:13,color:MUTED,textAlign:'center',marginBottom:16}}>Введи номер телефона<br/><span style={{fontSize:11}}>Придёт SMS-код для входа</span></div>
          <input style={{...S.input,fontSize:17,textAlign:'center',marginBottom:10,letterSpacing:1}} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+992 900 000000" type="tel"/>
          {err&&<div style={{fontSize:12,color:RED,textAlign:'center',marginBottom:8}}>{err}</div>}
          <button style={{...S.btn(GOLD)}} onClick={sendSMS} disabled={loading}>{loading?'Отправка...':'📱 Отправить SMS-код'}</button>
        </>
      )}
      {step==='code'&&(
        <>
          <div style={{fontSize:13,color:MUTED,textAlign:'center',marginBottom:16}}>Код отправлен на<br/><span style={{color:GOLD,fontWeight:700}}>{phone}</span></div>
          <input style={{...S.input,fontSize:26,textAlign:'center',letterSpacing:8,marginBottom:10}} value={code} onChange={e=>setCode(e.target.value)} placeholder="000000" type="number" autoFocus/>
          {err&&<div style={{fontSize:12,color:RED,textAlign:'center',marginBottom:8}}>{err}</div>}
          <button style={{...S.btn(GOLD),marginBottom:10}} onClick={verifyCode} disabled={loading}>{loading?'Проверка...':'✓ Подтвердить'}</button>
          <button style={{...S.btn('#2A2420'),color:CREAM,fontSize:13}} onClick={()=>{setStep('phone');setCode('');setErr('');}}>← Изменить номер</button>
        </>
      )}
      {step==='name'&&(
        <>
          <div style={{fontSize:13,color:MUTED,textAlign:'center',marginBottom:16}}>Первый вход!<br/>Введи своё имя</div>
          <input style={{...S.input,fontSize:16,textAlign:'center',marginBottom:12}} value={name} onChange={e=>setName(e.target.value)} placeholder="Например: Шахло" autoFocus/>
          {err&&<div style={{fontSize:12,color:RED,textAlign:'center',marginBottom:8}}>{err}</div>}
          <button style={S.btn(GOLD)} onClick={saveName} disabled={loading}>{loading?'Сохранение...':'✓ Начать смену'}</button>
        </>
      )}
    </div>
  );
}

function LoginScreen({onLogin,ownerPin}){
  const [mode,setMode]=useState(null);
  const [pin,setPin]=useState('');
  const [err,setErr]=useState('');
  const tryPin=()=>{if(pin===ownerPin)onLogin('owner');else{setErr('Неверный PIN');setPin('');}};
  return(
    <div style={{background:BG,minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:28}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:30,color:GOLD,letterSpacing:4,marginBottom:4}}>QUEEN STAR</div>
      <div style={{fontSize:9,color:MUTED,letterSpacing:4,marginBottom:48}}>ДУШАНБЕ · ТАДЖИКИСТАН</div>
      {!mode&&(
        <>
          <button style={{...S.btn(GOLD),marginBottom:12,borderRadius:12,padding:'16px 24px',fontSize:15}} onClick={()=>setMode('owner')}>👤 Амир (Владелец)</button>
          <button style={{...S.btn('#2A2420'),borderRadius:12,padding:'16px 24px',fontSize:15,color:CREAM}} onClick={()=>setMode('employee')}>🏪 Сотрудник — начать смену</button>
          <div style={{fontSize:11,color:MUTED,marginTop:24,textAlign:'center',lineHeight:1.8}}>Сотрудник входит через SMS<br/>Владелец через PIN</div>
        </>
      )}
      {mode==='owner'&&(
        <div style={{width:'100%',maxWidth:280}}>
          <div style={{fontSize:13,color:MUTED,textAlign:'center',marginBottom:14}}>PIN-код владельца</div>
          <input style={{...S.input,textAlign:'center',fontSize:26,letterSpacing:10,marginBottom:10}} type="password" maxLength={6} value={pin} onChange={e=>{setPin(e.target.value);setErr('');}} onKeyDown={e=>{if(e.key==='Enter')tryPin();}} placeholder="••••" autoFocus/>
          {err&&<div style={{fontSize:12,color:RED,textAlign:'center',marginBottom:8}}>{err}</div>}
          <button style={{...S.btn(GOLD),marginBottom:10}} onClick={tryPin}>Войти</button>
          <button style={{...S.btn('#2A2420'),color:CREAM,fontSize:13}} onClick={()=>{setMode(null);setPin('');setErr('');}}>← Назад</button>
        </div>
      )}
      {mode==='employee'&&(
        <>
          <EmployeePhoneLogin onLogin={onLogin}/>
          <button style={{...S.btn('#2A2420'),color:CREAM,fontSize:13,marginTop:10,maxWidth:300,width:'100%'}} onClick={()=>setMode(null)}>← Назад</button>
        </>
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
        <div>
          <div style={{...S.row,marginTop:10}}>
            <button style={{...S.btnSm(RED),flex:1}} onClick={()=>updateProduct(product.id,'qty',Math.max(0,product.qty-1))}>−1</button>
            <button style={{...S.btnSm(GREEN),flex:1}} onClick={()=>updateProduct(product.id,'qty',product.qty+1)}>+1</button>
            <button style={{...S.btnSm(AMBER),flex:1}} onClick={()=>{setResVal(String(product.reserved||0));setShowRes(!showRes);}}>🔒</button>
            <button style={{...S.btnSm(MUTED),flex:1}} onClick={()=>{setVal(String(product.qty));setEditing(true);}}>✏</button>
          </div>
          <div style={{marginTop:8}}>
            <QRCode productId={product.id} productName={product.name} price={product.price}/>
          </div>
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

function More({sales,expenses,products,monthRevenue,monthCOGS,monthExpenses,monthProfit,annaShare,settings,setSettings,onLogout,orders,setOrders,customers,addCustomer,purchases,addPurchase,updatePurchase,debts,addDebt,updateDebt,photos}){
  const [view,setView]=useState(null);
  const FIXED=5200;
  if(view==='shifts')   return <div><button style={{...S.btnSm(MUTED),marginBottom:12}} onClick={()=>setView(null)}>← Назад</button><ShiftsView shifts={shifts} sales={sales} onBack={()=>setView(null)}/></div>;
  if(view==='rates')    return <div><button style={{...S.btnSm(MUTED),marginBottom:12}} onClick={()=>setView(null)}>← Назад</button><ExchangeRates settings={settings} setSettings={setSettings}/></div>;
  if(view==='stories')  return <div><button style={{...S.btnSm(MUTED),marginBottom:12}} onClick={()=>setView(null)}>← Назад</button><StoriesGen products={products} photos={photos||{}}/></div>;
  if(view==='pricetags')return <div><button style={{...S.btnSm(MUTED),marginBottom:12}} onClick={()=>setView(null)}>← Назад</button><PriceTags products={products}/></div>;
  if(view==='schedule') return <div><button style={{...S.btnSm(MUTED),marginBottom:12}} onClick={()=>setView(null)}>← Назад</button><Schedule db={db}/></div>;
  if(view==='staff')    return <div><button style={{...S.btnSm(MUTED),marginBottom:12}} onClick={()=>setView(null)}>← Назад</button><Staff sales={sales} db={db}/></div>;
  if(view==='orders')   return <div><button style={{...S.btnSm(MUTED),marginBottom:12}} onClick={()=>setView(null)}>← Назад</button><Orders orders={orders} setOrders={setOrders} products={products}/></div>;
  if(view==='customers')return <div><button style={{...S.btnSm(MUTED),marginBottom:12}} onClick={()=>setView(null)}>← Назад</button><Customers customers={customers} addCustomer={addCustomer} orders={orders}/></div>;
  if(view==='analytics')return <div><button style={{...S.btnSm(MUTED),marginBottom:12}} onClick={()=>setView(null)}>← Назад</button><Analytics sales={sales} orders={orders} customers={customers}/></div>;
  if(view==='purchases')return <div><button style={{...S.btnSm(MUTED),marginBottom:12}} onClick={()=>setView(null)}>← Назад</button><Purchases purchases={purchases} addPurchase={addPurchase} updatePurchase={updatePurchase}/></div>;
  if(view==='debts')    return <div><button style={{...S.btnSm(MUTED),marginBottom:12}} onClick={()=>setView(null)}>← Назад</button><Debts debts={debts} addDebt={addDebt} updateDebt={updateDebt}/></div>;
  if(view==='history')  return <History sales={sales} onBack={()=>setView(null)}/>;
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
        <input style={S.input} type="number" min="1" max="20" value={settings.lowStock} onChange={e=>setSettings({...settings,lowStock:Number(e.target.value)||5})}/>
      </div>
      <div style={S.card}>
        <div style={S.sec}>Сменить PIN</div>
        <PinChange settings={settings} setSettings={setSettings}/>
      </div>
    </div>
  );
  const items=[
    {id:'shifts',   icon:'⏱️',label:'Смены',        sub:'Статистика сотрудников, кто сколько продал'},
    {id:'rates',    icon:'💱',label:'Курс онлайн',   sub:'Актуальные курсы USD, CNY, RUB'},
    {id:'stories',  icon:'📸',label:'Instagram',     sub:'Генератор карточек для сторис'},
    {id:'pricetags',icon:'🏷️',label:'Ценники',       sub:'Печать ценников для товаров'},
    {id:'schedule', icon:'📅',label:'Расписание',    sub:'График смен сотрудников'},
    {id:'staff',    icon:'👨‍💼',label:'Сотрудники',   sub:'Продажи по каждому сотруднику'},
    {id:'orders',   icon:'🛍️',label:'Заказы',       sub:'Instagram заказы и доставка'},
    {id:'customers',icon:'👥',label:'Клиенты',      sub:'База покупателей'},
    {id:'analytics',icon:'📈',label:'Аналитика',    sub:'Графики, топ товары, средний чек'},
    {id:'purchases',icon:'🛒',label:'Закупки',      sub:'Планирование закупок с 1688'},
    {id:'debts',    icon:'💸',label:'Долги/Авансы', sub:'Кто должен, чьи авансы'},
    {id:'history',  icon:'📋',label:'История продаж',sub:'По месяцам, наличные/переводы'},
    {id:'investor', icon:'💼',label:'Инвестор',     sub:'Расчёт доли Анны (25%)'},
    {id:'export',   icon:'📊',label:'Экспорт Excel',sub:'Продажи + склад + расходы'},
    {id:'settings', icon:'⚙️',label:'Настройки',   sub:'PIN, порог остатка'},
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
    setSettings({...settings,pin:newPin});setNewPin('');setConf('');
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


// ── ЗАКАЗЫ ────────────────────────────────────────────────────
function Orders({orders,setOrders,products}){
  const [view,setView]=useState('list');
  const [f,setF]=useState({name:'',phone:'',productId:'',qty:'1',price:'',payment:'cash',note:''});
  const [msg,setMsg]=useState('');
  const ST={new:{l:'Новый',c:AMBER},delivery:{l:'В доставке',c:BLUE},done:{l:'Выдан',c:GREEN},cancelled:{l:'Отмена',c:RED}};
  const NEXT={new:'delivery',delivery:'done'};
  const avail=products.filter(p=>!p.transit&&(p.qty-(p.reserved||0))>0);
  const pick=(id)=>{const p=products.find(x=>x.id===id);setF(v=>({...v,productId:id,price:p?String(p.price):''}));};
  const submit=()=>{
    if(!f.name||!f.productId||!f.price){setMsg('Заполни имя, товар и цену');return;}
    const p=products.find(x=>x.id===f.productId);
    setOrders(prev=>[{id:Date.now(),date:nowStr(),status:'new',customerName:f.name,customerPhone:f.phone,productId:f.productId,productName:p?.name||'',qty:Number(f.qty),price:Number(f.price),total:Number(f.qty)*Number(f.price),payment:f.payment,note:f.note},...prev]);
    setF({name:'',phone:'',productId:'',qty:'1',price:'',payment:'cash',note:''});
    setView('list');setMsg('✓ Заказ создан');setTimeout(()=>setMsg(''),2000);
  };
  const advance=(id)=>setOrders(prev=>prev.map(o=>{if(o.id!==id)return o;const n=NEXT[o.status];return n?{...o,status:n}:o;}));
  const cancel=(id)=>setOrders(prev=>prev.map(o=>o.id===id?{...o,status:'cancelled'}:o));
  const active=orders.filter(o=>o.status!=='done'&&o.status!=='cancelled');
  const done=orders.filter(o=>o.status==='done'||o.status==='cancelled');

  if(view==='new')return(
    <div>
      <button style={{...S.btnSm(MUTED),marginBottom:12}} onClick={()=>setView('list')}>← Назад</button>
      <div style={S.card}>
        <div style={S.sec}>Новый заказ</div>
        <div style={{marginBottom:10}}><div style={S.label}>Имя клиента</div><input style={S.input} value={f.name} onChange={e=>setF(v=>({...v,name:e.target.value}))} placeholder="Имя покупателя"/></div>
        <div style={{marginBottom:10}}><div style={S.label}>Телефон</div><input style={S.input} value={f.phone} onChange={e=>setF(v=>({...v,phone:e.target.value}))} placeholder="+992..."/></div>
        <div style={{marginBottom:10}}><div style={S.label}>Товар</div>
          <select style={S.select} value={f.productId} onChange={e=>pick(e.target.value)}>
            <option value="">— Выберите —</option>
            {avail.map(p=><option key={p.id} value={p.id}>{p.name} ({p.qty-(p.reserved||0)} шт)</option>)}
          </select>
        </div>
        <div style={{...S.row,marginBottom:10}}>
          <div style={S.half}><div style={S.label}>Кол-во</div><input style={S.input} type="number" min="1" value={f.qty} onChange={e=>setF(v=>({...v,qty:e.target.value}))}/></div>
          <div style={S.half}><div style={S.label}>Цена</div><input style={S.input} type="number" value={f.price} onChange={e=>setF(v=>({...v,price:e.target.value}))}/></div>
        </div>
        <div style={{marginBottom:10}}><div style={S.label}>Оплата</div><PaymentToggle value={f.payment} onChange={v=>setF(x=>({...x,payment:v}))}/></div>
        <div style={{marginBottom:12}}><div style={S.label}>Заметка (адрес, Instagram)</div><input style={S.input} value={f.note} onChange={e=>setF(v=>({...v,note:e.target.value}))} placeholder="ул. Рудаки 10, @username..."/></div>
        {msg&&<div style={{fontSize:12,color:msg.startsWith('✓')?GREEN:RED,marginBottom:8}}>{msg}</div>}
        <button style={S.btn()} onClick={submit}>Создать заказ</button>
      </div>
    </div>
  );

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div style={S.sec}>Активные ({active.length})</div>
        <button style={S.btnSm(GOLD)} onClick={()=>setView('new')}>+ Заказ</button>
      </div>
      {msg&&<div style={{fontSize:12,color:GREEN,marginBottom:8}}>{msg}</div>}
      {active.length===0&&<div style={{color:MUTED,textAlign:'center',padding:'20px 0',fontSize:13}}>Нет активных заказов</div>}
      {active.map(o=>{
        const st=ST[o.status];
        return(
          <div key={o.id} style={{...S.card,borderColor:st.c+'44'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <div>
                <div style={{fontSize:15,fontWeight:700}}>{o.customerName}</div>
                {o.customerPhone&&<div style={{fontSize:11,color:MUTED}}>{o.customerPhone}</div>}
              </div>
              <Badge text={st.l} color={st.c}/>
            </div>
            <div style={{fontSize:13}}>{o.productName} × {o.qty} = <b>{fmt(o.total)} сом</b></div>
            <div style={{fontSize:11,color:MUTED,marginTop:3}}>{shortDate(o.date)} · {o.payment==='cash'?'💵 Наличные':'📲 Перевод'}</div>
            {o.note&&<div style={{fontSize:11,color:BLUE,marginTop:4}}>📍 {o.note}</div>}
            <div style={{...S.row,marginTop:10}}>
              {NEXT[o.status]&&<button style={{...S.btnSm(GREEN),flex:2}} onClick={()=>advance(o.id)}>{o.status==='new'?'🚚 В доставку':'✓ Выдан'}</button>}
              <button style={{...S.btnSm(RED),flex:1}} onClick={()=>cancel(o.id)}>Отмена</button>
            </div>
          </div>
        );
      })}
      {done.length>0&&(
        <>
          <div style={{...S.sec,marginTop:16}}>Завершённые</div>
          {done.slice(0,15).map(o=>(
            <div key={o.id} style={S.li}>
              <div><div style={{fontSize:13,fontWeight:600}}>{o.customerName}</div><div style={{fontSize:11,color:MUTED}}>{o.productName} · {shortDate(o.date)}</div></div>
              <div style={{display:'flex',alignItems:'center',gap:8}}><Badge text={ST[o.status].l} color={ST[o.status].c}/><b style={{color:o.status==='done'?GREEN:MUTED}}>{fmt(o.total)}</b></div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── КЛИЕНТЫ ───────────────────────────────────────────────────
function Customers({customers,addCustomer,orders}){
  const [show,setShow]=useState(false);
  const [f,setF]=useState({name:'',phone:'',note:''});
  const [msg,setMsg]=useState('');

  const submit=()=>{
    if(!f.name){setMsg('Введи имя');return;}
    addCustomer(f);setF({name:'',phone:'',note:''});setShow(false);
    setMsg('✓ Клиент добавлен');setTimeout(()=>setMsg(''),2000);
  };

  const enriched=customers.map(c=>{
    const co=orders.filter(o=>o.customerPhone===c.phone||o.customerName===c.name);
    return{...c,orderCount:co.length,totalSpent:co.filter(o=>o.status==='done').reduce((s,o)=>s+o.total,0)};
  }).sort((a,b)=>b.totalSpent-a.totalSpent);

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div style={S.sec}>Клиенты ({customers.length})</div>
        <button style={S.btnSm(show?RED:GOLD)} onClick={()=>setShow(!show)}>{show?'✕':'+ Клиент'}</button>
      </div>
      {msg&&<div style={{fontSize:12,color:msg.startsWith('✓')?GREEN:RED,marginBottom:8}}>{msg}</div>}
      {show&&(
        <div style={{...S.card,borderColor:GOLD+'55',marginBottom:12}}>
          <div style={{marginBottom:8}}><div style={S.label}>Имя</div><input style={S.input} value={f.name} onChange={e=>setF(v=>({...v,name:e.target.value}))} placeholder="Зарина"/></div>
          <div style={{marginBottom:8}}><div style={S.label}>Телефон</div><input style={S.input} value={f.phone} onChange={e=>setF(v=>({...v,phone:e.target.value}))} placeholder="+992..."/></div>
          <div style={{marginBottom:12}}><div style={S.label}>Заметка</div><input style={S.input} value={f.note} onChange={e=>setF(v=>({...v,note:e.target.value}))} placeholder="VIP, постоянный..."/></div>
          <button style={S.btn()} onClick={submit}>Добавить</button>
        </div>
      )}
      {enriched.length===0&&<div style={{color:MUTED,textAlign:'center',padding:'24px 0',fontSize:13}}>Клиентов пока нет</div>}
      {enriched.map(c=>(
        <div key={c.id} style={S.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <div style={{fontSize:15,fontWeight:700}}>{c.name}</div>
              {c.phone&&<div style={{fontSize:12,color:MUTED,marginTop:2}}>📞 {c.phone}</div>}
              {c.note&&<div style={{fontSize:11,color:BLUE,marginTop:2}}>{c.note}</div>}
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:18,fontWeight:700,color:GREEN}}>{fmt(c.totalSpent)}</div>
              <div style={{fontSize:10,color:MUTED}}>сом потрачено</div>
              <div style={{fontSize:11,color:MUTED}}>{c.orderCount} заказов</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── АНАЛИТИКА ─────────────────────────────────────────────────
function Analytics({sales,orders,customers}){
  const days=7;
  const labels=[];
  const vals=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    const key=d.toISOString().slice(0,10);
    labels.push(d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'}));
    vals.push(sales.filter(s=>s.date.startsWith(key)).reduce((s,x)=>s+x.total,0));
  }
  const maxVal=Math.max(...vals,1);

  const thisMonth=new Date().toISOString().slice(0,7);
  const mS=sales.filter(s=>s.date.startsWith(thisMonth));
  const revenue=mS.reduce((s,x)=>s+x.total,0);
  const cashRev=mS.filter(s=>s.paymentMethod==='cash').reduce((s,x)=>s+x.total,0);
  const transRev=mS.filter(s=>s.paymentMethod==='transfer').reduce((s,x)=>s+x.total,0);

  const byProduct=mS.reduce((acc,s)=>{acc[s.name]=(acc[s.name]||0)+s.total;return acc;},{});
  const topProds=Object.entries(byProduct).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const avgDay=revenue/new Date().getDate();
  const doneOrders=orders.filter(o=>o.status==='done').length;

  return(
    <div>
      <div style={{...S.row,marginBottom:10}}>
        <StatBox label="Выручка мес." value={fmt(revenue)} unit="сом" color={GREEN}/>
        <StatBox label="Ср. в день" value={fmt(avgDay)} unit="сом" color={GOLD}/>
      </div>
      <div style={{...S.row,marginBottom:14}}>
        <StatBox label="Заказов выдано" value={doneOrders} unit="шт" color={BLUE}/>
        <StatBox label="Клиентов" value={customers.length} unit="чел" color={AMBER}/>
      </div>

      <div style={S.card}>
        <div style={S.sec}>Продажи — последние 7 дней</div>
        <div style={{display:'flex',alignItems:'flex-end',gap:4,height:80,marginBottom:8}}>
          {vals.map((v,i)=>(
            <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
              <div style={{fontSize:8,color:MUTED}}>{v>0?fmt(v):''}</div>
              <div style={{width:'100%',background:v>0?GOLD+'88':BORD,borderRadius:'3px 3px 0 0',height:`${Math.max((v/maxVal)*60,2)}px`,transition:'height 0.3s'}}/>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:4}}>
          {labels.map((l,i)=><div key={i} style={{flex:1,textAlign:'center',fontSize:8,color:MUTED}}>{l}</div>)}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.sec}>Наличные vs Перевод</div>
        <div style={{display:'flex',height:12,borderRadius:6,overflow:'hidden',marginBottom:10}}>
          <div style={{width:`${revenue>0?cashRev/revenue*100:50}%`,background:GREEN,transition:'width 0.5s'}}/>
          <div style={{flex:1,background:BLUE}}/>
        </div>
        <FR label="💵 Наличные" value={fmt(cashRev)+' сом'} color={GREEN}/>
        <FR label="📲 Переводы" value={fmt(transRev)+' сом'} color={BLUE}/>
      </div>

      {topProds.length>0&&(
        <div style={S.card}>
          <div style={S.sec}>Топ товаров (месяц)</div>
          {topProds.map(([name,total],i)=>(
            <div key={name} style={S.li}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:13,color:GOLD,fontWeight:700}}>#{i+1}</span>
                <span style={{fontSize:13}}>{name}</span>
              </div>
              <span style={{fontWeight:700,color:GREEN}}>{fmt(total)} сом</span>
            </div>
          ))}
        </div>
      )}

      {(()=>{const byEmp=mS.reduce((acc,s)=>{const n=s.employeeName||'Неизвестно';if(!acc[n])acc[n]={cnt:0,rev:0};acc[n].cnt++;acc[n].rev+=s.total;return acc;},{});const entries=Object.entries(byEmp);return entries.length>0?(
        <div style={S.card}>
          <div style={S.sec}>Продажи по сотрудникам</div>
          {entries.map(([name,d])=>(
            <div key={name} style={S.li}>
              <div><div style={{fontSize:13,fontWeight:600}}>{name}</div><div style={{fontSize:11,color:MUTED}}>{d.cnt} продаж</div></div>
              <span style={{fontWeight:700,color:GREEN}}>{fmt(d.rev)} сом</span>
            </div>
          ))}
        </div>
      ):null;})()}
    </div>
  );
}

// ── ЗАКУПКИ ───────────────────────────────────────────────────
function Purchases({purchases,addPurchase,updatePurchase}){
  const [show,setShow]=useState(false);
  const [f,setF]=useState({name:'',qty:'',priceCny:'',weight:'0.9',note:'',expectedDate:''});
  const [msg,setMsg]=useState('');
  const ST={planned:{l:'Планируется',c:MUTED},ordered:{l:'Заказано',c:AMBER},shipped:{l:'В пути',c:BLUE},received:{l:'Получено',c:GREEN}};
  const NEXT={planned:'ordered',ordered:'shipped',shipped:'received'};

  const submit=()=>{
    if(!f.name||!f.qty||!f.priceCny){setMsg('Заполни название, кол-во и цену');return;}
    addPurchase({...f,qty:Number(f.qty),priceCny:Number(f.priceCny),weight:Number(f.weight)||0.9});
    setF({name:'',qty:'',priceCny:'',weight:'0.9',note:'',expectedDate:''});
    setShow(false);setMsg('✓ Закупка добавлена');setTimeout(()=>setMsg(''),2000);
  };

  const active=purchases.filter(p=>p.status!=='received');
  const done=purchases.filter(p=>p.status==='received');

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div style={S.sec}>Закупки ({active.length} активных)</div>
        <button style={S.btnSm(show?RED:GOLD)} onClick={()=>setShow(!show)}>{show?'✕':'+ Закупка'}</button>
      </div>
      {msg&&<div style={{fontSize:12,color:msg.startsWith('✓')?GREEN:RED,marginBottom:8}}>{msg}</div>}
      {show&&(
        <div style={{...S.card,borderColor:GOLD+'55',marginBottom:12}}>
          <div style={S.sec}>Новая закупка</div>
          <div style={{marginBottom:8}}><div style={S.label}>Название товара</div><input style={S.input} value={f.name} onChange={e=>setF(v=>({...v,name:e.target.value}))} placeholder="Туфли женские летние"/></div>
          <div style={{...S.row,marginBottom:8}}>
            <div style={S.half}><div style={S.label}>Кол-во (пар)</div><input style={S.input} type="number" value={f.qty} onChange={e=>setF(v=>({...v,qty:e.target.value}))} placeholder="20"/></div>
            <div style={S.half}><div style={S.label}>Цена (¥ за пару)</div><input style={S.input} type="number" value={f.priceCny} onChange={e=>setF(v=>({...v,priceCny:e.target.value}))} placeholder="15"/></div>
          </div>
          <div style={{...S.row,marginBottom:8}}>
            <div style={S.half}><div style={S.label}>Вес пары (кг)</div><input style={S.input} type="number" step="0.1" value={f.weight} onChange={e=>setF(v=>({...v,weight:e.target.value}))}/></div>
            <div style={S.half}><div style={S.label}>Ожид. дата</div><input style={S.input} type="date" value={f.expectedDate} onChange={e=>setF(v=>({...v,expectedDate:e.target.value}))}/></div>
          </div>
          <div style={{marginBottom:12}}><div style={S.label}>Ссылка / заметка</div><input style={S.input} value={f.note} onChange={e=>setF(v=>({...v,note:e.target.value}))} placeholder="1688.com/..."/></div>
          <button style={S.btn()} onClick={submit}>Добавить</button>
        </div>
      )}

      {active.length===0&&<div style={{color:MUTED,textAlign:'center',padding:'20px 0',fontSize:13}}>Нет активных закупок</div>}
      {active.map(p=>{
        const st=ST[p.status];
        const totalCny=p.qty*p.priceCny;
        return(
          <div key={p.id} style={{...S.card,borderColor:st.c+'44'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
              <div style={{fontSize:14,fontWeight:700,flex:1}}>{p.name}</div>
              <Badge text={st.l} color={st.c}/>
            </div>
            <div style={{fontSize:13,color:MUTED}}>{p.qty} пар · ¥{p.priceCny}/пара · итого ¥{totalCny}</div>
            {p.expectedDate&&<div style={{fontSize:11,color:AMBER,marginTop:2}}>📅 Ожидается: {new Date(p.expectedDate).toLocaleDateString('ru-RU')}</div>}
            {p.note&&<div style={{fontSize:11,color:BLUE,marginTop:2}}>🔗 {p.note}</div>}
            {NEXT[p.status]&&(
              <button style={{...S.btnSm(GREEN),marginTop:10,width:'100%'}} onClick={()=>updatePurchase(p.id,'status',NEXT[p.status])}>
                {p.status==='planned'?'✓ Заказано':p.status==='ordered'?'🚚 Отправили':'📦 Получили'}
              </button>
            )}
          </div>
        );
      })}

      {done.length>0&&(
        <>
          <div style={{...S.sec,marginTop:16}}>Полученные ({done.length})</div>
          {done.slice(0,5).map(p=>(
            <div key={p.id} style={S.li}>
              <div><div style={{fontSize:13,fontWeight:600}}>{p.name}</div><div style={{fontSize:11,color:MUTED}}>{p.qty} пар · {shortDate(p.orderDate)}</div></div>
              <Badge text="Получено" color={GREEN}/>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── ДОЛГИ ─────────────────────────────────────────────────────
function Debts({debts,addDebt,updateDebt}){
  const [show,setShow]=useState(false);
  const [f,setF]=useState({name:'',amount:'',type:'debt',note:''});
  const [msg,setMsg]=useState('');

  const submit=()=>{
    if(!f.name||!f.amount){setMsg('Введи имя и сумму');return;}
    addDebt({...f,amount:Number(f.amount)});
    setF({name:'',amount:'',type:'debt',note:''});setShow(false);
    setMsg('✓ Добавлено');setTimeout(()=>setMsg(''),2000);
  };

  const active=debts.filter(d=>!d.paid);
  const paid=debts.filter(d=>d.paid);
  const totalDebt=active.filter(d=>d.type==='debt').reduce((s,d)=>s+d.amount,0);
  const totalAdv=active.filter(d=>d.type==='advance').reduce((s,d)=>s+d.amount,0);

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div style={S.sec}>Долги и авансы</div>
        <button style={S.btnSm(show?RED:GOLD)} onClick={()=>setShow(!show)}>{show?'✕':'+ Добавить'}</button>
      </div>

      {(totalDebt>0||totalAdv>0)&&(
        <div style={S.card}>
          <FR label="💰 Нам должны" value={fmt(totalDebt)+' сом'} color={GREEN}/>
          <FR label="📥 Авансы получены" value={fmt(totalAdv)+' сом'} color={BLUE}/>
        </div>
      )}

      {msg&&<div style={{fontSize:12,color:msg.startsWith('✓')?GREEN:RED,marginBottom:8}}>{msg}</div>}
      {show&&(
        <div style={{...S.card,borderColor:GOLD+'55',marginBottom:12}}>
          <div style={{...S.row,marginBottom:8}}>
            {[{v:'debt',l:'💰 Должны нам'},{v:'advance',l:'📥 Аванс'}].map(opt=>(
              <div key={opt.v} onClick={()=>setF(v=>({...v,type:opt.v}))}
                style={{flex:1,padding:'9px 6px',textAlign:'center',fontSize:12,fontWeight:600,cursor:'pointer',
                  background:f.type===opt.v?GOLD+'22':SURF,color:f.type===opt.v?GOLD:MUTED,
                  borderRadius:8,border:`1px solid ${f.type===opt.v?GOLD+'44':BORD}`}}>
                {opt.l}
              </div>
            ))}
          </div>
          <div style={{marginBottom:8}}><div style={S.label}>Имя / кто</div><input style={S.input} value={f.name} onChange={e=>setF(v=>({...v,name:e.target.value}))} placeholder="Зарина, Магазин..."/></div>
          <div style={{...S.row,marginBottom:12}}>
            <div style={S.half}><div style={S.label}>Сумма (сом)</div><input style={S.input} type="number" value={f.amount} onChange={e=>setF(v=>({...v,amount:e.target.value}))} placeholder="500"/></div>
            <div style={S.half}><div style={S.label}>Заметка</div><input style={S.input} value={f.note} onChange={e=>setF(v=>({...v,note:e.target.value}))} placeholder="..."/></div>
          </div>
          <button style={S.btn()} onClick={submit}>Добавить</button>
        </div>
      )}

      {active.length===0&&<div style={{color:MUTED,textAlign:'center',padding:'20px 0',fontSize:13}}>Нет активных долгов</div>}
      {active.map(d=>(
        <div key={d.id} style={{...S.card,borderColor:(d.type==='debt'?GREEN:BLUE)+'44'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:14,fontWeight:700}}>{d.name}</div>
              <div style={{fontSize:11,color:MUTED,marginTop:2}}>{shortDate(d.date)}{d.note?' · '+d.note:''}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:20,fontWeight:700,color:d.type==='debt'?GREEN:BLUE}}>{fmt(d.amount)}</div>
              <div style={{fontSize:10,color:MUTED}}>{d.type==='debt'?'должны нам':'аванс'}</div>
            </div>
          </div>
          <button style={{...S.btnSm(GREEN),marginTop:10,width:'100%'}} onClick={()=>updateDebt(d.id,'paid',true)}>✓ Погашено</button>
        </div>
      ))}

      {paid.length>0&&(
        <>
          <div style={{...S.sec,marginTop:16}}>Погашенные ({paid.length})</div>
          {paid.slice(0,5).map(d=>(
            <div key={d.id} style={S.li}>
              <div><div style={{fontSize:13,fontWeight:600}}>{d.name}</div><div style={{fontSize:11,color:MUTED}}>{shortDate(d.date)}</div></div>
              <div style={{display:'flex',alignItems:'center',gap:8}}><Badge text="Погашено" color={GREEN}/><b>{fmt(d.amount)}</b></div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}


// ── СМЕНЫ ─────────────────────────────────────────────────────
function ShiftsView({shifts,sales,onBack}){
  const byEmp=shifts.reduce((acc,sh)=>{
    const n=sh.employeeName;
    if(!acc[n])acc[n]={name:n,phone:sh.phone,shifts:0,sales:0,revenue:0};
    acc[n].shifts++;
    const ss=sales.filter(s=>s.employeeId===sh.employeeId&&s.date>=sh.startTime);
    acc[n].sales+=ss.length;
    acc[n].revenue+=ss.reduce((s,x)=>s+x.total,0);
    return acc;
  },{});

  return(
    <div>
      <button style={{...S.btnSm(MUTED),marginBottom:12}} onClick={onBack}>← Назад</button>
      <div style={S.sec}>Статистика сотрудников</div>
      {Object.values(byEmp).length===0&&<div style={{color:MUTED,textAlign:'center',padding:'24px 0',fontSize:13}}>Данных пока нет</div>}
      {Object.values(byEmp).map(e=>(
        <div key={e.name} style={S.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <div style={{fontSize:15,fontWeight:700}}>{e.name}</div>
              {e.phone&&<div style={{fontSize:11,color:MUTED,marginTop:2}}>📞 {e.phone}</div>}
              <div style={{fontSize:11,color:MUTED,marginTop:4}}>{e.shifts} смен · {e.sales} продаж</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:22,fontWeight:700,color:GREEN}}>{fmt(e.revenue)}</div>
              <div style={{fontSize:10,color:MUTED}}>сом выручки</div>
            </div>
          </div>
        </div>
      ))}
      <div style={{...S.sec,marginTop:16}}>История смен</div>
      {shifts.slice(0,20).map(sh=>{
        const ss=sales.filter(s=>s.employeeId===sh.employeeId&&s.date>=sh.startTime);
        const rev=ss.reduce((s,x)=>s+x.total,0);
        return(
          <div key={sh.id} style={S.li}>
            <div>
              <div style={{fontSize:13,fontWeight:600}}>{sh.employeeName}</div>
              <div style={{fontSize:11,color:MUTED}}>{shortDate(sh.startTime)} · {shortTime(sh.startTime)}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontWeight:700,color:GREEN}}>{fmt(rev)} сом</div>
              <div style={{fontSize:10,color:MUTED}}>{ss.length} продаж</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ── СОТРУДНИКИ (статистика) ───────────────────────────────────
function Staff({sales,db}){
  const [employees,setEmployees]=useState([]);

  useEffect(()=>{
    const q=query(collection(db,'employees'));
    const unsub=onSnapshot(q,snap=>{
      setEmployees(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return()=>unsub();
  },[]);

  const today=new Date().toISOString().slice(0,10);
  const thisMonth=new Date().toISOString().slice(0,7);

  const stats=employees.map(emp=>{
    const empSales=sales.filter(s=>s.employeeId===emp.id||s.employeeName===emp.name);
    const todaySales=empSales.filter(s=>s.date.startsWith(today));
    const monthSales=empSales.filter(s=>s.date.startsWith(thisMonth));
    return{
      ...emp,
      todayCount:todaySales.length,
      todayTotal:todaySales.reduce((s,x)=>s+x.total,0),
      monthCount:monthSales.length,
      monthTotal:monthSales.reduce((s,x)=>s+x.total,0),
      allCount:empSales.length,
      allTotal:empSales.reduce((s,x)=>s+x.total,0),
    };
  }).sort((a,b)=>b.monthTotal-a.monthTotal);

  return(
    <div>
      <div style={S.sec}>Сотрудники ({employees.length})</div>
      {stats.length===0&&<div style={{color:MUTED,textAlign:'center',padding:'24px 0',fontSize:13}}>Нет зарегистрированных сотрудников</div>}
      {stats.map(emp=>(
        <div key={emp.id} style={S.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
            <div>
              <div style={{fontSize:16,fontWeight:700}}>{emp.name}</div>
              <div style={{fontSize:11,color:MUTED,marginTop:2}}>📞 {emp.phone}</div>
            </div>
            <Badge text="Активный" color={GREEN}/>
          </div>
          <div style={{...S.row,marginBottom:6}}>
            <div style={{flex:1,background:SURF,borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
              <div style={{fontSize:18,fontWeight:700,color:GREEN}}>{fmt(emp.todayTotal)}</div>
              <div style={{fontSize:9,color:MUTED,marginTop:2}}>СЕГОДНЯ</div>
            </div>
            <div style={{flex:1,background:SURF,borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
              <div style={{fontSize:18,fontWeight:700,color:GOLD}}>{fmt(emp.monthTotal)}</div>
              <div style={{fontSize:9,color:MUTED,marginTop:2}}>МЕСЯЦ</div>
            </div>
            <div style={{flex:1,background:SURF,borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
              <div style={{fontSize:18,fontWeight:700,color:BLUE}}>{emp.allCount}</div>
              <div style={{fontSize:9,color:MUTED,marginTop:2}}>ПРОДАЖ</div>
            </div>
          </div>
        </div>
      ))}
      <div style={{...S.card,borderColor:AMBER+'44',marginTop:8}}>
        <div style={{fontSize:12,color:MUTED,lineHeight:1.7}}>
          💡 Сотрудник регистрируется один раз через номер телефона.<br/>
          Каждая продажа автоматически записывается на его аккаунт.
        </div>
      </div>
    </div>
  );
}


// ── TOAST УВЕДОМЛЕНИЯ ────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = (msg, color=GREEN) => {
    const id = Date.now();
    setToasts(p => [...p, {id, msg, color}]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  };
  return { toasts, add };
}

function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position:'fixed', top:70, left:0, right:0, zIndex:999, padding:'0 12px', pointerEvents:'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background:t.color, color:'#000', borderRadius:10, padding:'10px 14px',
          marginBottom:8, fontSize:13, fontWeight:600, boxShadow:'0 4px 12px rgba(0,0,0,0.4)' }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── КУРС ОНЛАЙН ───────────────────────────────────────────────
function ExchangeRates({ settings, setSettings }) {
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState('');

  const fetch_ = async () => {
    setLoading(true);
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      const d = await r.json();
      if (d.rates?.TJS) {
        const usd = parseFloat(d.rates.TJS.toFixed(2));
        const rub = parseFloat((d.rates.TJS / d.rates.RUB).toFixed(3));
        const cny = parseFloat((d.rates.TJS / d.rates.CNY).toFixed(3));
        setRates({ usd, rub, cny });
        // auto rate update handled separately
        setLast(new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }));
      }
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={S.sec}>Курсы онлайн</div>
        <button style={S.btnSm(GOLD)} onClick={fetch_}>{loading ? '...' : '↻ Обновить'}</button>
      </div>
      {last && <div style={{ fontSize:10, color:MUTED, marginBottom:10 }}>Обновлено: {last}</div>}
      {rates ? (
        <div style={S.card}>
          <FR label="1 USD = сомони" value={rates.usd+' сом'} color={GREEN} bold/>
          <FR label="1 RUB = сомони" value={rates.rub+' сом'} color={BLUE}/>
          <FR label="1 CNY = сомони" value={rates.cny+' сом'} color={GOLD}/>
        </div>
      ) : (
        <div style={{ color:MUTED, textAlign:'center', padding:24 }}>Загрузка...</div>
      )}
      <div style={S.card}>
        <div style={S.sec}>Текущие настройки калькулятора</div>
        <FR label="USD в расчётах" value={settings.usdRate+' сом'}/>
        <FR label="CNY в расчётах" value={settings.cnyRate+' сом'}/>
        {rates && (
          <button style={{ ...S.btn(GOLD), marginTop:12 }}
            onClick={()=>setSettings({...settings, usdRate:rates.usd, cnyRate:rates.cny})}>
            Применить актуальные курсы
          </button>
        )}
      </div>
    </div>
  );
}

// ── STORIES ГЕНЕРАТОР ─────────────────────────────────────────
function StoriesGen({ products, photos }) {
  const [pid, setPid] = useState('');
  const [price, setPrice] = useState('');
  const [disc, setDisc] = useState('');
  const [generated, setGenerated] = useState(false);
  const canvasRef = useRef();

  const generate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 1080; canvas.height = 1080;
    const product = products.find(p => p.id === pid);
    const finalPrice = price || product?.price || '';
    const discPrice = disc ? Math.round(finalPrice * (1 - disc/100)) : null;

    // Background
    const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
    grad.addColorStop(0, '#0A0908'); grad.addColorStop(1, '#1A1510');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1080);

    // Border
    ctx.strokeStyle = '#C9952A'; ctx.lineWidth = 6;
    ctx.strokeRect(24, 24, 1032, 1032);
    ctx.strokeStyle = '#C9952A33'; ctx.lineWidth = 1;
    ctx.strokeRect(32, 32, 1016, 1016);

    // Draw photo if exists
    const photo = photos[pid];
    const drawText = () => {
      // Brand
      ctx.fillStyle = '#C9952A';
      ctx.font = 'bold 64px serif'; ctx.textAlign = 'center';
      ctx.fillText('QUEEN STAR', 540, 100);
      ctx.font = '22px sans-serif'; ctx.fillStyle = '#6A6055';
      ctx.fillText('ДУШАНБЕ · ТАДЖИКИСТАН', 540, 138);

      // Product name
      if (product) {
        ctx.fillStyle = '#F2EDE4'; ctx.font = 'bold 52px sans-serif';
        ctx.fillText(product.name, 540, 900);
      }

      // Price
      if (finalPrice) {
        if (discPrice) {
          ctx.fillStyle = '#6A6055'; ctx.font = '46px sans-serif';
          ctx.fillText(finalPrice+' сом', 540, 960);
          // Strikethrough
          const w = ctx.measureText(finalPrice+' сом').width;
          ctx.strokeStyle = RED; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(540-w/2, 955); ctx.lineTo(540+w/2, 955); ctx.stroke();
          ctx.fillStyle = '#C9952A'; ctx.font = 'bold 80px sans-serif';
          ctx.fillText(discPrice+' сом', 540, 1040);
        } else {
          ctx.fillStyle = '#C9952A'; ctx.font = 'bold 88px sans-serif';
          ctx.fillText(finalPrice+' сом', 540, 1010);
        }
      }
      setGenerated(true);
    };

    if (photo) {
      const img = new Image();
      img.onload = () => {
        const size = 680;
        const x = (1080-size)/2; const y = 160;
        ctx.save();
        ctx.beginPath();
        moveTo(x+20,y);ctx.lineTo(x+size-20,y);ctx.arcTo(x+size,y,x+size,y+20,20);ctx.lineTo(x+size,y+size-20);ctx.arcTo(x+size,y+size,x+size-20,y+size,20);ctx.lineTo(x+20,y+size);ctx.arcTo(x,y+size,x,y+size-20,20);ctx.lineTo(x,y+20);ctx.arcTo(x,y,x+20,y,20);ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, x, y, size, size);
        ctx.restore();
        drawText();
      };
      img.src = photo;
    } else {
      // Placeholder
      ctx.fillStyle = '#1A1816';
      ctx.fillRect(190, 160, 700, 680);
      ctx.fillStyle = '#2A2520'; ctx.font = '80px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('👟', 540, 560);
      drawText();
    }
  };

  const download = () => {
    const canvas = canvasRef.current;
    const a = document.createElement('a');
    a.download = 'queen-star-post.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  return (
    <div>
      <div style={S.card}>
        <div style={S.sec}>📸 Instagram карточка</div>
        <div style={{ marginBottom:10 }}>
          <div style={S.label}>Товар</div>
          <select style={S.select} value={pid} onChange={e => { setPid(e.target.value); const p=products.find(x=>x.id===e.target.value); if(p)setPrice(String(p.price)); }}>
            <option value="">— Выберите —</option>
            {products.filter(p=>!p.transit).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div style={{ ...S.row, marginBottom:12 }}>
          <div style={S.half}><div style={S.label}>Цена (сом)</div><input style={S.input} type="number" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Авто"/></div>
          <div style={S.half}><div style={S.label}>Скидка (%)</div><input style={S.input} type="number" value={disc} onChange={e=>setDisc(e.target.value)} placeholder="0"/></div>
        </div>
        <button style={{ ...S.btn(GOLD), marginBottom:10 }} onClick={generate}>🎨 Создать</button>
      </div>
      <canvas ref={canvasRef} style={{ width:'100%', borderRadius:12, display:'block', marginBottom:10 }}/>
      {generated && <button style={S.btn(GREEN)} onClick={download}>📥 Скачать PNG для Instagram</button>}
    </div>
  );
}

// ── ЦЕННИКИ ───────────────────────────────────────────────────
function PriceTags({ products }) {
  const [sel, setSel] = useState([]);
  const toggle = (id) => setSel(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id]);
  const selAll = () => setSel(products.filter(p=>!p.transit).map(p=>p.id));

  const print = () => {
    const items = products.filter(p => sel.includes(p.id));
    const tags = items.map(p => `
      <div style="width:85mm;height:54mm;border:2px solid #C9952A;border-radius:6px;padding:8px;display:inline-flex;flex-direction:column;justify-content:space-between;margin:4px;background:#fff;box-sizing:border-box;vertical-align:top">
        <div style="font-family:serif;font-size:14px;font-weight:bold;color:#C9952A;letter-spacing:2px">QUEEN STAR</div>
        <div style="font-size:13px;font-weight:600;color:#222">${p.name}</div>
        <div>
          <div style="font-size:9px;color:#999">SKU: ${p.id}</div>
          <div style="font-size:28px;font-weight:bold;color:#C9952A">${new Intl.NumberFormat('ru-RU').format(p.price)} сом</div>
        </div>
      </div>
    `).join('');
    const w = window.open('');
    w.document.write(`<html><body style="margin:10px;font-family:sans-serif">
      <div style="margin-bottom:10px"><button onclick="window.print()">🖨️ Печать</button></div>
      <div>${tags}</div>
    </body></html>`);
    w.document.close();
  };

  const inStock = products.filter(p=>!p.transit);
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={S.sec}>🏷️ Ценники</div>
        <button style={S.btnSm(MUTED)} onClick={selAll}>Выбрать все</button>
      </div>
      <div style={{ ...S.card, marginBottom:12 }}>
        <div style={{ fontSize:12, color:MUTED }}>Выбери товары для печати ценников</div>
      </div>
      {inStock.map(p => (
        <div key={p.id} onClick={() => toggle(p.id)}
          style={{ ...S.card, cursor:'pointer', display:'flex', alignItems:'center', gap:12,
            borderColor: sel.includes(p.id) ? GOLD+'88' : BORD,
            background: sel.includes(p.id) ? GOLD+'11' : CARD }}>
          <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${sel.includes(p.id)?GOLD:BORD}`,
            background: sel.includes(p.id)?GOLD:'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>
            {sel.includes(p.id) ? '✓' : ''}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
            <div style={{ fontSize:11, color:MUTED }}>{p.id}</div>
          </div>
          <div style={{ fontWeight:700, color:GOLD }}>{fmt(p.price)} сом</div>
        </div>
      ))}
      {sel.length > 0 && (
        <button style={{ ...S.btn(GOLD), marginTop:8 }} onClick={print}>
          🖨️ Распечатать {sel.length} ценников
        </button>
      )}
    </div>
  );
}

// ── РАСПИСАНИЕ СМЕН ───────────────────────────────────────────
function Schedule({ db }) {
  const [employees, setEmployees] = useState([]);
  const [sched, setSched] = useState({});
  const [saving, setSaving] = useState(false);
  const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const DAYS_EN = ['mon','tue','wed','thu','fri','sat','sun'];

  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db,'employees'), snap => {
        setEmployees(snap.docs.map(d=>({id:d.id,...d.data()})));
      });
      getDoc(doc(db,'qs','schedule'))
        .then(snap => { if(snap.exists()&&snap.data()?.v) setSched(JSON.parse(snap.data().v)); })
        .catch(()=>{});
      return () => unsub();
    } catch {}
  }, []);

  const toggle = (empId, day) => {
    setSched(p => {
      const key = `${empId}_${day}`;
      const next = { ...p, [key]: !p[key] };
      setDoc(doc(db,'qs','schedule'), { v: JSON.stringify(next), ts: Date.now() }).catch(()=>{});
      return next;
    });
  };

  const isOn = (empId, day) => !!sched[`${empId}_${day}`];

  return (
    <div>
      <div style={S.sec}>📅 Расписание смен</div>
      {employees.length === 0 && (
        <div style={{ color:MUTED, textAlign:'center', padding:'24px 0', fontSize:13 }}>
          Нет сотрудников. Сначала зарегистрируй через SMS.
        </div>
      )}
      {employees.map(emp => (
        <div key={emp.id} style={{ ...S.card, marginBottom:12 }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:10 }}>{emp.name}</div>
          <div style={{ display:'flex', gap:4 }}>
            {DAYS.map((day, i) => (
              <div key={day} onClick={() => toggle(emp.id, DAYS_EN[i])}
                style={{ flex:1, textAlign:'center', padding:'8px 0', borderRadius:8, cursor:'pointer',
                  background: isOn(emp.id, DAYS_EN[i]) ? GREEN+'33' : SURF,
                  border: `1px solid ${isOn(emp.id, DAYS_EN[i]) ? GREEN : BORD}`,
                  color: isOn(emp.id, DAYS_EN[i]) ? GREEN : MUTED,
                  fontSize:10, fontWeight:700 }}>
                {day}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ fontSize:11, color:MUTED, textAlign:'center', marginTop:8 }}>
        Нажми на день чтобы включить/выключить смену
      </div>
    </div>
  );
}

// ── QR КОДЫ ───────────────────────────────────────────────────
function QRCode({ productId, productName, price }) {
  const [show, setShow] = useState(false);
  const text = `Queen Star | ${productName} | ${price} сом | SKU:${productId}`;
  const url = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(text)}&choe=UTF-8`;

  return (
    <div>
      <button style={S.btnSm(MUTED)} onClick={() => setShow(!show)}>
        {show ? '✕' : '▦ QR'}
      </button>
      {show && (
        <div style={{ marginTop:8, textAlign:'center' }}>
          <img src={url} alt="QR" style={{ width:120, height:120, borderRadius:8 }}/>
          <div style={{ fontSize:10, color:MUTED, marginTop:4 }}>{productId}</div>
        </div>
      )}
    </div>
  );
}


function Chat({role}){
  const [messages,setMessages]=useState([]);
  const [text,setText]=useState('');
  const bottomRef=useRef();

  useEffect(()=>{
    const q=query(collection(db,'qs_chat'),orderBy('ts','asc'));
    const unsub=onSnapshot(q,snap=>{
      setMessages(snap.docs.map(d=>({id:d.id,...d.data()})));
      setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),100);
    });
    return()=>unsub();
  },[]);

  const send=async()=>{
    if(!text.trim())return;
    const msg=text.trim();setText('');
    await addDoc(collection(db,'qs_chat'),{
      text:msg,
      sender:role,
      name:role==='owner'?'👤 Амир':currentEmployee?`🏪 ${currentEmployee.name}`:'🏪 Сотрудник',
      ts:Date.now(),
    });
  };

  return(
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 164px)'}}>
      <div style={{flex:1,overflowY:'auto',paddingBottom:8}}>
        {messages.length===0&&<div style={{color:MUTED,textAlign:'center',padding:'32px 0',fontSize:13}}>Сообщений пока нет</div>}
        {messages.map(msg=>{
          const isMe=msg.sender===role;
          return(
            <div key={msg.id} style={{display:'flex',justifyContent:isMe?'flex-end':'flex-start',marginBottom:8}}>
              <div style={{maxWidth:'78%',background:isMe?GOLD+'22':CARD,border:`1px solid ${isMe?GOLD+'44':BORD}`,borderRadius:isMe?'12px 12px 2px 12px':'12px 12px 12px 2px',padding:'8px 12px'}}>
                <div style={{fontSize:10,color:isMe?GOLD:BLUE,marginBottom:3,fontWeight:700}}>{msg.name}</div>
                <div style={{fontSize:14,color:CREAM,lineHeight:1.4}}>{msg.text}</div>
                <div style={{fontSize:10,color:MUTED,marginTop:3,textAlign:'right'}}>{msg.ts?shortTime(new Date(msg.ts).toISOString()):''}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>
      <div style={{...S.row,paddingTop:8,borderTop:`1px solid ${BORD}`}}>
        <input style={{...S.input,flex:1}} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')send();}} placeholder="Напиши сообщение..."/>
        <button style={{...S.btnSm(GOLD),padding:'10px 16px',fontSize:18,borderRadius:8}} onClick={send}>➤</button>
      </div>
    </div>
  );
}

export default function QueenStar(){
  const { toasts, add: addToast } = useToast();
  const [role,setRole]=useState(null);
  const [currentEmployee,setCurrentEmployee]=useState(null);
  const [tab,setTab]=useState('dash');
  const [products,setProducts]=useState(INIT_PRODUCTS);
  const [sales,setSales]=useState([]);
  const [expenses,setExpenses]=useState([]);
  const [settings,setSettings]=useState(INIT_SETTINGS);
  const [photos,setPhotos]=useState({});
  const [orders,setOrders]=useState([]);
  const [customers,setCustomers]=useState([]);
  const [purchases,setPurchases]=useState([]);
  const [debts,setDebts]=useState([]);
  const [employee,setEmployee]=useState(null);
  const [shifts,setShifts]=useState([]);
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    const timer=setTimeout(()=>setReady(true),5000);
    (async()=>{
      try{
        const keys=['products','sales','expenses','settings','photos','orders','customers','purchases','debts'];
        const sets=[setProducts,setSales,setExpenses,setSettings,setPhotos,setOrders,setCustomers,setPurchases,setDebts];
        const snaps=await Promise.allSettled(keys.map(k=>getDoc(doc(db,'qs',k))));
        snaps.forEach((s,i)=>{
          if(s.status==='fulfilled'&&s.value?.exists&&s.value.exists())
            try{const v=s.value.data()?.v;if(v){const parsed=JSON.parse(v);sets[i](parsed);if(keys[i]==='settings')fsSettings.current=parsed;}}catch{}
        });
      }catch(e){console.error('Load error:',e);}
      clearTimeout(timer);
      setReady(true);
    })();
  },[]);

  // Auto-fetch exchange rate on load
  useEffect(()=>{
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r=>r.json())
      .then(d=>{if(d.rates?.TJS){const usd=parseFloat(d.rates.TJS.toFixed(2));setSettings(prev=>({...prev,usdRate:usd}));}})
      .catch(()=>{});
  },[]);

  const lw=useRef({});
  const fsSettings=useRef(null); // Track Firebase-loaded settings
  const saveFS=(key,data)=>{const ts=Date.now();lw.current[key]=ts;setDoc(doc(db,'qs',key),{v:JSON.stringify(data),ts}).catch(()=>{});};

  useEffect(()=>{
    const listen=(key,setter)=>{
      try{
        return onSnapshot(
          doc(db,'qs',key),
          snap=>{if(snap.exists()){const d=snap.data();if(d?.v&&d?.ts!==lw.current[key])try{setter(JSON.parse(d.v));}catch{}}},
          err=>console.warn('Sync:',key,err.code)
        );
      }catch{return ()=>{};}
    };
    const u=[
      listen('products',setProducts),listen('sales',setSales),
      listen('expenses',setExpenses),listen('settings',setSettings),
      listen('orders',setOrders),listen('customers',setCustomers),
      listen('purchases',setPurchases),listen('debts',setDebts)
    ];
    return()=>u.forEach(fn=>fn&&fn());
  },[]);

  useEffect(()=>{if(ready)saveFS('products',products);},[products,ready]);
  useEffect(()=>{if(ready)saveFS('sales',sales);},[sales,ready]);
  useEffect(()=>{if(ready)saveFS('expenses',expenses);},[expenses,ready]);
  useEffect(()=>{if(ready)saveFS('photos',photos);},[photos,ready]);
  useEffect(()=>{if(ready)saveFS('orders',orders);},[orders,ready]);
  useEffect(()=>{if(ready)saveFS('customers',customers);},[customers,ready]);
  useEffect(()=>{if(ready)saveFS('purchases',purchases);},[purchases,ready]);
  useEffect(()=>{if(ready)saveFS('debts',debts);},[debts,ready]);
  useEffect(()=>{if(ready)saveFS('shifts',shifts);},[shifts,ready]);

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
    setSales(prev=>[{id:Date.now(),productId,name:product.name,qty:Number(qty),price:Number(price),cost:product.cost,total:Number(qty)*Number(price),date:nowStr(),note,paymentMethod,employeeId:employee?.uid||'owner',employeeName:employee?.name||'Амир'},...prev]);
    setProducts(prev=>prev.map(p=>p.id===productId?{...p,qty:p.qty-Number(qty)}:p));
  };
  const addExpense=(cat,amount,note)=>setExpenses(prev=>[{id:Date.now(),category:cat,amount:Number(amount),date:nowStr(),note},...prev]);
  const updateProduct=(id,field,value)=>setProducts(prev=>prev.map(p=>p.id===id?{...p,[field]:value}:p));
  const addProduct=(prod)=>setProducts(prev=>[...prev,prod]);
  const onPhoto=(pid,data)=>setPhotos(prev=>({...prev,[pid]:data}));
  const saveSettings=(newSettings)=>{
    setSettings(newSettings);
    saveFS('settings',newSettings);
    fsSettings.current=newSettings;
  };
  const prevOrdersLen = useRef(0);
  useEffect(()=>{
    if(orders.length > prevOrdersLen.current && prevOrdersLen.current > 0)
      addToast('🛍️ Новый заказ добавлен!', GOLD);
    prevOrdersLen.current = orders.length;
  },[orders]);

  const addOrder=(o)=>setOrders(prev=>[{id:Date.now(),date:nowStr(),status:'new',...o},...prev]);
  const updateOrder=(id,f,v)=>setOrders(prev=>prev.map(o=>o.id===id?{...o,[f]:v}:o));
  const addCustomer=(c)=>setCustomers(prev=>[{id:Date.now(),date:nowStr(),...c},...prev]);
  const updateCustomer=(id,f,v)=>setCustomers(prev=>prev.map(c=>c.id===id?{...c,[f]:v}:c));
  const addPurchase=(p)=>setPurchases(prev=>[{id:Date.now(),orderDate:nowStr(),status:'planned',...p},...prev]);
  const updatePurchase=(id,f,v)=>setPurchases(prev=>prev.map(p=>p.id===id?{...p,[f]:v}:p));
  const addDebt=(d)=>setDebts(prev=>[{id:Date.now(),date:nowStr(),paid:false,...d},...prev]);
  const updateDebt=(id,f,v)=>setDebts(prev=>prev.map(d=>d.id===id?{...d,[f]:v}:d));

  const OWNER_TABS=[{id:'dash',icon:'⬡',label:'Главная'},{id:'kassa',icon:'◎',label:'Касса'},{id:'stock',icon:'▦',label:'Склад'},{id:'finance',icon:'◈',label:'Финансы'},{id:'chat',icon:'💬',label:'Чат'},{id:'more',icon:'☰',label:'Ещё'}];
  const EMP_TABS=[{id:'dash',icon:'⬡',label:'Главная'},{id:'kassa',icon:'◎',label:'Касса'},{id:'stock',icon:'▦',label:'Склад'},{id:'chat',icon:'💬',label:'Чат'}];
  const TABS=role==='owner'?OWNER_TABS:EMP_TABS;
  const fin={monthRevenue,monthCOGS,monthExpenses,monthProfit,annaShare};
  const shared={products,updateProduct,addProduct};

  if(!ready)return(
    <div style={{background:BG,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
      <div style={{color:GOLD,fontSize:22,letterSpacing:4,fontFamily:"serif"}}>QUEEN STAR</div>
      <div style={{fontSize:12,color:MUTED}}>Подключение...</div>
      <div style={{width:40,height:2,background:GOLD,borderRadius:2,animation:'none'}}/>
    </div>
  );

  if(!role)return(
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}`}</style>
      <LoginScreen onLogin={(r,emp)=>{setRole(r);setTab('dash');if(r==='employee'&&emp){setEmployee(emp);const sh={id:Date.now(),employeeId:emp.uid,employeeName:emp.name,phone:emp.phone,startTime:nowStr(),active:true};setShifts(prev=>[sh,...prev]);saveFS('shifts',[sh,...shifts]);}}} ownerPin={settings.pin}/>
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
          <div style={{fontSize:11,color:role==='owner'?GOLD:MUTED,fontWeight:600}}>{role==='owner'?'👤 Амир':('🏪 '+(employee?.name||'Сотрудник'))}</div>
          <div style={{fontSize:10,color:GREEN,marginTop:2}}>● Онлайн</div>
        </div>
      </div>

      <LowStockBanner products={products} threshold={settings.lowStock}/>

      <div style={S.page}>
        {tab==='dash'&&<Dashboard {...{todayRevenue,totalStock,todaySales,products,settings,...fin}}/>}
        {tab==='kassa'&&<Kassa {...{...shared,addSale,todaySales,role,employee}}/>}
        {tab==='stock'&&<Stock {...{...shared,photos,onPhoto,role,settings}}/>}
        {tab==='finance'&&role==='owner'&&<Finance {...{expenses,addExpense,sales,...fin}}/>}
        {tab==='calc'&&role==='owner'&&<Calc {...{settings,setSettings:saveSettings}}/>}
        {tab==='chat'&&<Chat role={role}/>}
        {tab==='more'&&role==='owner'&&<More {...{sales,expenses,...shared,...fin,settings,setSettings:saveSettings,photos,onLogout:()=>setRole(null),orders,setOrders,customers,setCustomers,purchases,setPurchases,debts,setDebts,addOrder,addCustomer,addPurchase,addDebt,updateOrder,updateCustomer,updatePurchase,updateDebt}}/>}
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
