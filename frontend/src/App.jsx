import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  MessageSquare, TrendingUp, Send, Upload, LogOut, ShieldCheck,
  BookOpen, RefreshCw, FileText, Trash2, Search, ChevronLeft,
  ChevronRight, BarChart2, AlertCircle, CheckCircle, Loader, X,
  Layers, Star, Clock, Hash, Bell, Download, ClipboardList,
  PlusCircle, Calendar, HelpCircle, MessageCircle, CheckSquare,
  Award, ChevronDown, ChevronUp, BookMarked, Inbox, Send as SendIcon
} from 'lucide-react';
import './App.css';

const API      = "http://127.0.0.1:8000";
const POLL_MS  = 25_000;
const STUDENT  = "student";   // demo student identity

// ─── Colour helpers ───────────────────────────────────────────────────────────
const PALETTE = [
  {bg:'#eff6ff',border:'#bfdbfe',text:'#1d4ed8',dot:'#3b82f6'},
  {bg:'#f0fdf4',border:'#bbf7d0',text:'#15803d',dot:'#22c55e'},
  {bg:'#fdf4ff',border:'#e9d5ff',text:'#7e22ce',dot:'#a855f7'},
  {bg:'#fff7ed',border:'#fed7aa',text:'#c2410c',dot:'#f97316'},
  {bg:'#fefce8',border:'#fde68a',text:'#92400e',dot:'#eab308'},
  {bg:'#fff1f2',border:'#fecdd3',text:'#be123c',dot:'#f43f5e'},
  {bg:'#f0fdfa',border:'#99f6e4',text:'#0f766e',dot:'#14b8a6'},
  {bg:'#f5f3ff',border:'#ddd6fe',text:'#6d28d9',dot:'#8b5cf6'},
];
const CM = {}; let _ci = 0;
function sc(sub) { if (!CM[sub]){CM[sub]=PALETTE[_ci%PALETTE.length];_ci++;} return CM[sub]; }
function pc(s){ if(s>=80)return'#16a34a'; if(s>=60)return'#2563eb'; if(s>=40)return'#d97706'; return'#64748b'; }
function fmtDate(iso){ if(!iso)return'—'; try{return new Date(iso).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});}catch{return iso.slice(0,10);} }
function fmtTime(iso){ if(!iso)return'—'; try{return new Date(iso).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}catch{return iso.slice(0,16);} }

// ─── Reusable atoms ───────────────────────────────────────────────────────────
const SubjectTag = ({subject}) => {
  const c=sc(subject);
  return <span style={{display:'inline-flex',alignItems:'center',gap:5,background:c.bg,border:`1px solid ${c.border}`,color:c.text,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}><span style={{width:6,height:6,borderRadius:'50%',background:c.dot,flexShrink:0}}/>{subject}</span>;
};
const ScoreBadge = ({score}) => { const c=pc(score); return <span style={{background:c+'18',border:`1px solid ${c}40`,color:c,padding:'4px 12px',borderRadius:20,fontSize:13,fontWeight:800,whiteSpace:'nowrap'}}>{score}%</span>; };
const ProgressBar = ({value}) => { const c=pc(value); return <div style={{width:'100%',height:6,background:'#f1f5f9',borderRadius:10,overflow:'hidden'}}><div style={{height:'100%',width:`${value}%`,borderRadius:10,background:c,transition:'width 1s ease-out'}}/></div>; };
const Spin = () => <Loader size={16} style={{animation:'spin 1s linear infinite'}}/>;

function Toast({msg,type,onClose}){
  useEffect(()=>{const t=setTimeout(onClose,5000);return()=>clearTimeout(t);},[onClose]);
  const err=type==='error';
  return <div style={{position:'fixed',bottom:24,right:24,zIndex:9999,background:err?'#fef2f2':'#f0fdf4',border:`1px solid ${err?'#fecaca':'#bbf7d0'}`,color:err?'#dc2626':'#15803d',padding:'14px 18px',borderRadius:12,boxShadow:'0 8px 24px rgba(0,0,0,0.14)',display:'flex',alignItems:'center',gap:10,maxWidth:420,fontSize:14,fontWeight:500,animation:'slideUp 0.3s ease'}}>
    {err?<AlertCircle size={18}/>:<CheckCircle size={18}/>}
    <span style={{flex:1}}>{msg}</span>
    <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',padding:0,color:'inherit'}}><X size={15}/></button>
  </div>;
}

const GLOBAL_CSS = `
  @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes bellRing{0%,100%{transform:rotate(0)}15%{transform:rotate(14deg)}30%{transform:rotate(-11deg)}45%{transform:rotate(9deg)}60%{transform:rotate(-7deg)}75%{transform:rotate(4deg)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
`;

// ─── Notification Bell ────────────────────────────────────────────────────────
function NotificationBell({assignments,seenIds,doubts,onMarkSeen,onTabOpen}){
  const [open,setOpen]=useState(false);
  const ref=useRef();
  const unseenAsg  = assignments.filter(a=>!seenIds.has(a.id));
  const answeredQ  = doubts.filter(d=>d.status==='answered'&&!seenIds.has('d'+d.id));
  const total      = unseenAsg.length+answeredQ.length;

  useEffect(()=>{
    const fn=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener('mousedown',fn); return()=>document.removeEventListener('mousedown',fn);
  },[]);

  return <div ref={ref} style={{position:'relative'}}>
    <button onClick={()=>setOpen(v=>!v)} style={{position:'relative',background:open?'#eff6ff':'transparent',border:`1px solid ${open?'#bfdbfe':'transparent'}`,borderRadius:10,padding:'8px 10px',cursor:'pointer',display:'flex',alignItems:'center',transition:'all 0.2s'}}>
      <Bell size={20} color={total>0?'#2563eb':'#6b7280'} style={{animation:total>0?'bellRing 2s ease infinite':'none'}}/>
      {total>0&&<span style={{position:'absolute',top:4,right:4,background:'#ef4444',color:'#fff',borderRadius:'50%',width:17,height:17,fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid #fff'}}>{total>9?'9+':total}</span>}
    </button>
    {open&&<div style={{position:'absolute',top:'calc(100% + 10px)',right:0,width:360,background:'#fff',borderRadius:14,boxShadow:'0 12px 40px rgba(0,0,0,0.16)',border:'1px solid #e2e8f0',zIndex:1000,overflow:'hidden'}}>
      <div style={{padding:'14px 18px',borderBottom:'1px solid #f1f5f9',background:'linear-gradient(135deg,#1e40af,#4f46e5)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{color:'#fff',fontWeight:700,fontSize:15,display:'flex',alignItems:'center',gap:8}}><Bell size={16}/> Notifications {total>0&&<span style={{background:'rgba(255,255,255,0.25)',borderRadius:20,padding:'1px 8px',fontSize:11}}>{total} new</span>}</span>
        {total>0&&<button onClick={()=>{onMarkSeen([...unseenAsg.map(a=>a.id),...answeredQ.map(d=>'d'+d.id)]);setOpen(false);}} style={{background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.3)',color:'#fff',borderRadius:8,padding:'4px 10px',cursor:'pointer',fontSize:11,fontWeight:600}}>Mark all read</button>}
      </div>
      <div style={{maxHeight:320,overflowY:'auto'}}>
        {unseenAsg.map(a=><div key={a.id} onClick={()=>{onMarkSeen([a.id]);onTabOpen('assignments');setOpen(false);}} style={{padding:'12px 18px',borderBottom:'1px solid #f8fafc',background:'#eff6ff',display:'flex',gap:12,alignItems:'flex-start',cursor:'pointer'}}>
          <div style={{width:34,height:34,borderRadius:9,background:'#dbeafe',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><ClipboardList size={16} color='#2563eb'/></div>
          <div style={{flex:1}}><div style={{display:'flex',gap:6,marginBottom:2}}><span style={{background:'#2563eb',color:'#fff',borderRadius:4,padding:'1px 6px',fontSize:9,fontWeight:700}}>NEW</span><span style={{fontSize:13,fontWeight:700,color:'#1e293b'}}>{a.title}</span></div><p style={{margin:0,fontSize:12,color:'#64748b'}}>{a.subject}</p></div>
        </div>)}
        {answeredQ.map(d=><div key={'d'+d.id} onClick={()=>{onMarkSeen(['d'+d.id]);onTabOpen('doubts');setOpen(false);}} style={{padding:'12px 18px',borderBottom:'1px solid #f8fafc',background:'#f0fdf4',display:'flex',gap:12,alignItems:'flex-start',cursor:'pointer'}}>
          <div style={{width:34,height:34,borderRadius:9,background:'#dcfce7',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><MessageCircle size={16} color='#16a34a'/></div>
          <div style={{flex:1}}><div style={{display:'flex',gap:6,marginBottom:2}}><span style={{background:'#16a34a',color:'#fff',borderRadius:4,padding:'1px 6px',fontSize:9,fontWeight:700}}>ANSWERED</span><span style={{fontSize:13,fontWeight:700,color:'#1e293b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:200}}>{d.question}</span></div><p style={{margin:0,fontSize:12,color:'#64748b'}}>{d.subject}</p></div>
        </div>)}
        {total===0&&<div style={{padding:32,textAlign:'center',color:'#94a3b8',fontSize:13}}><Bell size={28} style={{marginBottom:8,opacity:0.3}}/><br/>All caught up!</div>}
      </div>
    </div>}
  </div>;
}

// ════════════════════════════════════════════════════════════════════════════
// STUDENT: DOUBTS TAB
// ════════════════════════════════════════════════════════════════════════════
function StudentDoubts({seenIds,onMarkSeen}){
  const [doubts,setDoubts]       = useState([]);
  const [subjectsList,setSL]     = useState([]);
  const [loading,setLoading]     = useState(false);
  const [posting,setPosting]     = useState(false);
  const [toast,setToast]         = useState(null);
  const [expanded,setExpanded]   = useState(null);
  const [form,setForm]           = useState({subject:'General',question:''});
  const showToast=(msg,type='success')=>setToast({msg,type});

  const fetchDoubts=useCallback(async()=>{
    setLoading(true);
    try{ const r=await axios.get(`${API}/api/doubts/student/${STUDENT}`); setDoubts(r.data||[]); }
    catch{ showToast('Could not load doubts.','error'); }
    finally{ setLoading(false); }
  },[]);

  useEffect(()=>{
    fetchDoubts();
    axios.get(`${API}/api/subjects_list`).then(r=>setSL(r.data||[])).catch(()=>{});
  },[]);

  const handleSubmit=async e=>{
    e.preventDefault();
    if(!form.question.trim()){ showToast('Please type your doubt.','error'); return; }
    setPosting(true);
    try{
      await axios.post(`${API}/api/doubts`,{student_name:STUDENT,subject:form.subject,question:form.question.trim()});
      showToast('✅ Doubt submitted! Teacher will reply soon.');
      setForm({...form,question:''});
      fetchDoubts();
    }catch{ showToast('Submit failed.','error'); }
    finally{ setPosting(false); }
  };

  const handleDelete=async id=>{
    if(!confirm('Delete this doubt?')) return;
    try{ await axios.delete(`${API}/api/doubts/${id}`); showToast('Doubt deleted.'); fetchDoubts(); }
    catch{ showToast('Delete failed.','error'); }
  };

  const pending  = doubts.filter(d=>d.status==='pending');
  const answered = doubts.filter(d=>d.status==='answered');

  return <div style={{padding:'22px 28px',overflowY:'auto',flex:1,display:'flex',flexDirection:'column',gap:20}}>
    <style>{GLOBAL_CSS}</style>

    {/* Hero */}
    <div style={{background:'linear-gradient(135deg,#0f766e,#0891b2)',borderRadius:16,padding:'20px 26px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
      <div>
        <h2 style={{margin:0,color:'#fff',fontSize:20,fontWeight:800,display:'flex',alignItems:'center',gap:10}}><HelpCircle size={22}/> Ask Your Teacher</h2>
        <p style={{margin:'4px 0 0',color:'#99f6e4',fontSize:13}}>Submit your doubts · Get answers directly from your instructor</p>
      </div>
      <div style={{display:'flex',gap:10}}>
        {[{v:pending.length,l:'Pending',c:'#f97316'},{v:answered.length,l:'Answered',c:'#22c55e'}].map(x=>(
          <div key={x.l} style={{background:'rgba(255,255,255,0.15)',borderRadius:10,padding:'8px 16px',textAlign:'center'}}>
            <p style={{margin:0,color:'#fff',fontWeight:800,fontSize:18}}>{x.v}</p>
            <p style={{margin:0,color:'rgba(255,255,255,0.7)',fontSize:11,fontWeight:600}}>{x.l}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Submit form */}
    <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'22px 24px'}}>
      <h3 style={{margin:'0 0 16px',fontSize:15,fontWeight:800,color:'#1e293b',display:'flex',alignItems:'center',gap:8}}><PlusCircle size={17} color='#0891b2'/> New Doubt</h3>
      <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:200}}>
            <label style={{fontSize:12,fontWeight:700,color:'#475569',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:0.5}}>Subject</label>
            <select value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} style={{width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:14,outline:'none',background:'#fff',boxSizing:'border-box'}}>
              <option>General</option>
              {subjectsList.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={{fontSize:12,fontWeight:700,color:'#475569',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:0.5}}>Your Doubt *</label>
          <textarea value={form.question} onChange={e=>setForm({...form,question:e.target.value})} rows={4}
            placeholder="Type your doubt or question in detail…"
            style={{width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:14,outline:'none',resize:'vertical',boxSizing:'border-box',fontFamily:'inherit',lineHeight:1.6,transition:'border-color 0.2s'}}
            onFocus={e=>e.target.style.borderColor='#0891b2'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
        </div>
        <button type="submit" disabled={posting} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:'linear-gradient(135deg,#0f766e,#0891b2)',color:'#fff',border:'none',borderRadius:10,padding:'12px',fontWeight:800,fontSize:15,cursor:posting?'not-allowed':'pointer',opacity:posting?0.7:1,boxShadow:'0 3px 10px rgba(8,145,178,0.3)'}}>
          {posting?<><Spin/> Submitting…</>:<><SendIcon size={16}/> Submit Doubt</>}
        </button>
      </form>
    </div>

    {/* Doubts list */}
    {loading ? <div style={{display:'flex',justifyContent:'center',padding:40}}><Spin/></div>
    : doubts.length===0 ? <div style={{textAlign:'center',padding:'40px 20px',background:'#f8fafc',borderRadius:14,border:'2px dashed #e2e8f0'}}><HelpCircle size={38} color='#cbd5e1' style={{marginBottom:12}}/><p style={{margin:0,color:'#94a3b8',fontSize:13}}>No doubts yet. Submit your first question above!</p></div>
    : <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {doubts.map(d=>{
          const isAnswered=d.status==='answered';
          const isNew=isAnswered&&!seenIds.has('d'+d.id);
          const isOpen=expanded===d.id;
          return <div key={d.id} style={{background:'#fff',border:`1px solid ${isNew?'#bbf7d0':isAnswered?'#e2e8f0':'#fed7aa'}`,borderRadius:12,overflow:'hidden',borderLeft:`4px solid ${isAnswered?'#22c55e':'#f97316'}`,animation:'fadeIn 0.25s ease'}}>
            <div style={{padding:'14px 18px',display:'flex',gap:12,alignItems:'flex-start',cursor:'pointer'}} onClick={()=>{ setExpanded(isOpen?null:d.id); if(isNew)onMarkSeen(['d'+d.id]); }}>
              <div style={{width:36,height:36,borderRadius:9,background:isAnswered?'#dcfce7':'#fff7ed',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {isAnswered?<CheckSquare size={17} color='#16a34a'/>:<Clock size={17} color='#f97316'/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',gap:8,marginBottom:4,flexWrap:'wrap',alignItems:'center'}}>
                  {isNew&&<span style={{background:'#16a34a',color:'#fff',borderRadius:4,padding:'1px 7px',fontSize:9,fontWeight:800}}>NEW ANSWER</span>}
                  <span style={{background:isAnswered?'#dcfce7':'#fff7ed',color:isAnswered?'#15803d':'#c2410c',borderRadius:6,padding:'2px 9px',fontSize:11,fontWeight:700}}>{isAnswered?'✅ Answered':'⏳ Pending'}</span>
                  <SubjectTag subject={d.subject}/>
                </div>
                <p style={{margin:'0 0 4px',fontSize:14,fontWeight:600,color:'#1e293b',lineHeight:1.5}}>{d.question}</p>
                <span style={{fontSize:11,color:'#94a3b8'}}>{fmtTime(d.created_at)}</span>
              </div>
              <div style={{display:'flex',gap:8,flexShrink:0,alignItems:'center'}}>
                {isOpen?<ChevronUp size={16} color='#94a3b8'/>:<ChevronDown size={16} color='#94a3b8'/>}
                <button onClick={e=>{e.stopPropagation();handleDelete(d.id);}} style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:7,padding:'5px 8px',cursor:'pointer',color:'#dc2626',display:'flex',alignItems:'center'}}><Trash2 size={13}/></button>
              </div>
            </div>
            {isOpen&&isAnswered&&<div style={{padding:'14px 18px 18px',borderTop:'1px solid #f1f5f9',background:'#f0fdf4'}}>
              <p style={{margin:'0 0 6px',fontSize:12,fontWeight:700,color:'#15803d',display:'flex',alignItems:'center',gap:6}}><MessageCircle size={13}/> Teacher's Answer — {d.answered_by||'Teacher'}</p>
              <p style={{margin:'0 0 6px',fontSize:14,color:'#1e293b',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{d.answer}</p>
              <span style={{fontSize:11,color:'#94a3b8'}}>{fmtTime(d.answered_at)}</span>
            </div>}
            {isOpen&&!isAnswered&&<div style={{padding:'12px 18px',borderTop:'1px solid #f1f5f9',background:'#fffbeb'}}>
              <p style={{margin:0,fontSize:13,color:'#92400e',fontStyle:'italic'}}>⏳ Waiting for teacher's response…</p>
            </div>}
          </div>;
        })}
      </div>}
    {toast&&<Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
  </div>;
}

// ════════════════════════════════════════════════════════════════════════════
// STUDENT: ASSIGNMENTS TAB (with Submit Work)
// ════════════════════════════════════════════════════════════════════════════
function StudentAssignments({assignments,seenIds,onMarkSeen,loading,mySubmissions,onSubmitted}){
  const [filter,setFilter]       = useState('All');
  const [submitting,setSubmitting]= useState(null);   // assignment id being submitted
  const [toast,setToast]         = useState(null);
  const subjects                 = ['All',...new Set(assignments.map(a=>a.subject))];
  const filtered                 = filter==='All' ? assignments : assignments.filter(a=>a.subject===filter);
  const showToast=(msg,type='success')=>setToast({msg,type});

  const handleDownload=a=>{ onMarkSeen([a.id]); window.open(`${API}/api/assignments/${a.id}/download`,'_blank'); };

  const handleSubmit=async(assignmentId, file)=>{
    if(!file){ showToast('Please select a file.','error'); return; }
    setSubmitting(assignmentId);
    const fd=new FormData(); fd.append('file',file); fd.append('student_name',STUDENT);
    try{
      await axios.post(`${API}/api/assignments/${assignmentId}/submit`,fd);
      showToast('✅ Assignment submitted successfully!');
      onSubmitted();
    }catch(err){ showToast(err?.response?.data?.detail||'Submit failed.','error'); }
    finally{ setSubmitting(null); }
  };

  const getMySubmission=aId=>mySubmissions.find(s=>s.assignment_id===aId);

  return <div style={{padding:'22px 28px',overflowY:'auto',flex:1,display:'flex',flexDirection:'column',gap:16}}>
    <style>{GLOBAL_CSS}</style>

    <div style={{background:'linear-gradient(135deg,#0f766e,#0891b2)',borderRadius:16,padding:'20px 26px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
      <div>
        <h2 style={{margin:0,color:'#fff',fontSize:20,fontWeight:800}}>📚 My Assignments</h2>
        <p style={{margin:'4px 0 0',color:'#99f6e4',fontSize:13}}>{assignments.length} assignment{assignments.length!==1?'s':''} · {mySubmissions.length} submitted</p>
      </div>
      {assignments.filter(a=>!seenIds.has(a.id)).length>0&&<button onClick={()=>onMarkSeen(assignments.map(a=>a.id))} style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',color:'#fff',borderRadius:10,padding:'9px 18px',cursor:'pointer',fontWeight:700,fontSize:13}}>Mark all read</button>}
    </div>

    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      {subjects.map(s=><button key={s} onClick={()=>setFilter(s)} style={{padding:'6px 14px',borderRadius:20,fontWeight:600,fontSize:12,cursor:'pointer',border:`1px solid ${filter===s?'#0891b2':'#e2e8f0'}`,background:filter===s?'#0891b2':'#fff',color:filter===s?'#fff':'#475569',transition:'all 0.2s'}}>{s}</button>)}
    </div>

    {loading ? <div style={{display:'flex',justifyContent:'center',padding:40}}><Spin/></div>
    : filtered.length===0 ? <div style={{textAlign:'center',padding:'50px 30px',background:'#f8fafc',borderRadius:14,border:'2px dashed #e2e8f0'}}><ClipboardList size={38} color='#cbd5e1' style={{marginBottom:12}}/><p style={{margin:0,color:'#94a3b8',fontSize:13}}>No assignments posted yet.</p></div>
    : <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {filtered.map(a=>{
          const isNew=!seenIds.has(a.id);
          const mySub=getMySubmission(a.id);
          const isSubmitting=submitting===a.id;
          const c=sc(a.subject);
          return <div key={a.id} style={{background:'#fff',border:`1px solid ${isNew?'#bfdbfe':'#e2e8f0'}`,borderRadius:14,padding:'18px 22px',borderLeft:`4px solid ${isNew?'#2563eb':c.dot}`,boxShadow:isNew?'0 2px 12px rgba(37,99,235,0.08)':'0 1px 4px rgba(0,0,0,0.04)',animation:'fadeIn 0.3s ease'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:14,marginBottom:12}}>
              <div style={{width:42,height:42,borderRadius:11,flexShrink:0,background:isNew?'#dbeafe':'#f8fafc',display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${isNew?'#bfdbfe':'#e2e8f0'}`}}>
                <FileText size={20} color={isNew?'#2563eb':'#94a3b8'}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
                  {isNew&&<span style={{background:'#2563eb',color:'#fff',borderRadius:5,padding:'2px 8px',fontSize:10,fontWeight:800}}>NEW</span>}
                  {mySub&&<span style={{background:mySub.grade?'#dcfce7':'#fff7ed',color:mySub.grade?'#15803d':'#92400e',borderRadius:5,padding:'2px 8px',fontSize:10,fontWeight:800}}>{mySub.grade?`✅ Graded: ${mySub.grade}`:'📤 Submitted'}</span>}
                  <h3 style={{margin:0,fontSize:16,fontWeight:700,color:'#1e293b'}}>{a.title}</h3>
                </div>
                {a.description&&<p style={{margin:'0 0 8px',fontSize:13,color:'#475569',lineHeight:1.5}}>{a.description}</p>}
                <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
                  <SubjectTag subject={a.subject}/>
                  {a.due_date&&<span style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:'#f97316',fontWeight:600}}><Calendar size={12}/> Due: {fmtDate(a.due_date)}</span>}
                  <span style={{fontSize:12,color:'#94a3b8'}}><Clock size={11}/> {fmtDate(a.posted_at)}</span>
                  <span style={{fontSize:12,color:'#94a3b8'}}>{a.file_size_str}</span>
                </div>
                {mySub?.feedback&&<div style={{marginTop:10,background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 14px'}}>
                  <p style={{margin:0,fontSize:12,fontWeight:700,color:'#15803d',marginBottom:4}}>📝 Teacher Feedback</p>
                  <p style={{margin:0,fontSize:13,color:'#166534'}}>{mySub.feedback}</p>
                </div>}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8,flexShrink:0}}>
                <button onClick={()=>handleDownload(a)} style={{display:'flex',alignItems:'center',gap:7,background:'linear-gradient(135deg,#1e40af,#4f46e5)',color:'#fff',border:'none',borderRadius:10,padding:'9px 16px',cursor:'pointer',fontWeight:700,fontSize:13,whiteSpace:'nowrap',boxShadow:'0 2px 8px rgba(37,99,235,0.25)'}}>
                  <Download size={14}/> Download
                </button>
              </div>
            </div>

            {/* Submit work section */}
            <div style={{borderTop:'1px solid #f1f5f9',paddingTop:12,marginTop:4}}>
              {mySub ? (
                <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                  <span style={{fontSize:13,color:'#64748b',fontWeight:500,display:'flex',alignItems:'center',gap:6}}><CheckSquare size={15} color='#22c55e'/> Submitted: {fmtTime(mySub.submitted_at)}</span>
                  <span style={{fontSize:12,color:'#94a3b8'}}>{mySub.original_name} · {mySub.file_size_str}</span>
                </div>
              ) : (
                <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{fontSize:13,color:'#64748b',fontWeight:600}}>Submit your work:</span>
                  <input
                    type="file"
                    id={`sub-${a.id}`}
                    hidden
                    disabled={isSubmitting}
                    onChange={e => {
                      const file = e.target.files[0];
                      e.target.value = '';
                      if (file) handleSubmit(a.id, file);
                    }}
                  />
                  <label htmlFor={`sub-${a.id}`} style={{display:'flex',alignItems:'center',gap:7,background:isSubmitting?'#e2e8f0':'linear-gradient(135deg,#0f766e,#0891b2)',color:isSubmitting?'#94a3b8':'#fff',border:'none',borderRadius:10,padding:'9px 18px',cursor:isSubmitting?'not-allowed':'pointer',fontWeight:700,fontSize:13,whiteSpace:'nowrap',transition:'all 0.2s',pointerEvents:isSubmitting?'none':'auto'}}>
                    {isSubmitting?<><Spin/> Uploading…</>:<><Upload size={14}/> Upload Submission</>}
                  </label>
                </div>
              )}
            </div>
          </div>;
        })}
      </div>}
    {toast&&<Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
  </div>;
}

// ════════════════════════════════════════════════════════════════════════════
// TEACHER: DOUBTS PANEL
// ════════════════════════════════════════════════════════════════════════════
function TeacherDoubts(){
  const [doubts,setDoubts]       = useState([]);
  const [loading,setLoading]     = useState(false);
  const [statusFilter,setStatus] = useState('all');
  const [answerState,setAns]     = useState({});   // {[id]: text}
  const [posting,setPosting]     = useState(null);
  const [toast,setToast]         = useState(null);
  const showToast=(msg,type='success')=>setToast({msg,type});

  const fetchDoubts=useCallback(async()=>{
    setLoading(true);
    try{ const r=await axios.get(`${API}/api/doubts`,{params:{status:statusFilter}}); setDoubts(r.data||[]); }
    catch{ showToast('Could not load doubts.','error'); }
    finally{ setLoading(false); }
  },[statusFilter]);

  useEffect(()=>{ fetchDoubts(); },[statusFilter]);

  const handleAnswer=async id=>{
    const text=(answerState[id]||'').trim();
    if(!text){ showToast('Please write an answer first.','error'); return; }
    setPosting(id);
    try{
      await axios.put(`${API}/api/doubts/${id}/answer`,{answer:text,answered_by:'Teacher'});
      showToast('✅ Answer sent to student!');
      setAns(p=>({...p,[id]:''}));
      fetchDoubts();
    }catch{ showToast('Submit failed.','error'); }
    finally{ setPosting(null); }
  };

  const handleDelete=async id=>{
    if(!confirm('Delete this doubt?')) return;
    try{ await axios.delete(`${API}/api/doubts/${id}`); showToast('Deleted.'); fetchDoubts(); }
    catch{ showToast('Delete failed.','error'); }
  };

  const pending  = doubts.filter(d=>d.status==='pending').length;
  const answered = doubts.filter(d=>d.status==='answered').length;

  return <div style={{padding:'22px 28px',overflowY:'auto',flex:1,display:'flex',flexDirection:'column',gap:18}}>
    <style>{GLOBAL_CSS}</style>

    {/* Hero */}
    <div style={{background:'linear-gradient(135deg,#7c3aed,#4f46e5)',borderRadius:16,padding:'20px 26px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
      <div><h2 style={{margin:0,color:'#fff',fontSize:20,fontWeight:800,display:'flex',alignItems:'center',gap:10}}><Inbox size={22}/> Student Doubts</h2><p style={{margin:'4px 0 0',color:'#ddd6fe',fontSize:13}}>Review and answer student queries</p></div>
      <div style={{display:'flex',gap:10}}>
        {[{v:pending,l:'Pending',c:'#f97316'},{v:answered,l:'Answered',c:'#22c55e'}].map(x=>(
          <div key={x.l} style={{background:'rgba(255,255,255,0.15)',borderRadius:10,padding:'8px 16px',textAlign:'center'}}>
            <p style={{margin:0,color:'#fff',fontWeight:800,fontSize:18}}>{x.v}</p>
            <p style={{margin:0,color:'rgba(255,255,255,0.7)',fontSize:11,fontWeight:600}}>{x.l}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Filter + refresh */}
    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
      {[['all','All'],['pending','Pending'],['answered','Answered']].map(([v,l])=>(
        <button key={v} onClick={()=>setStatus(v)} style={{padding:'7px 16px',borderRadius:20,fontWeight:600,fontSize:12,cursor:'pointer',border:`1px solid ${statusFilter===v?'#7c3aed':'#e2e8f0'}`,background:statusFilter===v?'#7c3aed':'#fff',color:statusFilter===v?'#fff':'#475569',transition:'all 0.2s'}}>{l}</button>
      ))}
      <button onClick={fetchDoubts} style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:9,padding:'7px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#64748b',fontWeight:600,marginLeft:'auto'}}>
        <RefreshCw size={13} style={{animation:loading?'spin 1s linear infinite':'none'}}/> Refresh
      </button>
    </div>

    {loading ? <div style={{display:'flex',justifyContent:'center',padding:40}}><Spin/></div>
    : doubts.length===0 ? <div style={{textAlign:'center',padding:'50px 30px',background:'#f8fafc',borderRadius:14,border:'2px dashed #e2e8f0'}}><Inbox size={38} color='#cbd5e1' style={{marginBottom:12}}/><p style={{margin:0,color:'#94a3b8',fontSize:13}}>No doubts {statusFilter!=='all'?`with status "${statusFilter}"`:''} yet.</p></div>
    : <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {doubts.map(d=>{
          const isAnswered=d.status==='answered';
          return <div key={d.id} style={{background:'#fff',border:`1px solid ${isAnswered?'#e2e8f0':'#fed7aa'}`,borderRadius:14,overflow:'hidden',borderLeft:`4px solid ${isAnswered?'#22c55e':'#f97316'}`,animation:'fadeIn 0.25s ease'}}>
            {/* Header */}
            <div style={{padding:'16px 20px',display:'flex',gap:12,alignItems:'flex-start'}}>
              <div style={{width:40,height:40,borderRadius:10,background:isAnswered?'#dcfce7':'#fff7ed',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {isAnswered?<CheckSquare size={19} color='#16a34a'/>:<HelpCircle size={19} color='#f97316'/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',gap:8,marginBottom:6,flexWrap:'wrap',alignItems:'center'}}>
                  <span style={{background:isAnswered?'#dcfce7':'#fff7ed',color:isAnswered?'#15803d':'#c2410c',borderRadius:6,padding:'2px 9px',fontSize:11,fontWeight:700}}>{isAnswered?'✅ Answered':'⏳ Pending'}</span>
                  <SubjectTag subject={d.subject}/>
                  <span style={{fontSize:12,color:'#94a3b8',display:'flex',alignItems:'center',gap:4}}><MessageCircle size={11}/> {d.student_name}</span>
                  <span style={{fontSize:12,color:'#94a3b8'}}>{fmtTime(d.created_at)}</span>
                </div>
                <p style={{margin:0,fontSize:15,fontWeight:600,color:'#1e293b',lineHeight:1.6}}>{d.question}</p>
              </div>
              <button onClick={()=>handleDelete(d.id)} style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'6px 10px',cursor:'pointer',color:'#dc2626',flexShrink:0,display:'flex',alignItems:'center',gap:4,fontSize:12,fontWeight:600}}><Trash2 size={12}/> Del</button>
            </div>

            {/* Existing answer */}
            {isAnswered&&<div style={{padding:'14px 20px',background:'#f0fdf4',borderTop:'1px solid #bbf7d0'}}>
              <p style={{margin:'0 0 6px',fontSize:12,fontWeight:700,color:'#15803d',display:'flex',alignItems:'center',gap:6}}><MessageCircle size={13}/> Your Answer — {d.answered_by||'Teacher'} · {fmtTime(d.answered_at)}</p>
              <p style={{margin:0,fontSize:14,color:'#166534',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{d.answer}</p>
            </div>}

            {/* Answer box (show for pending, or allow update) */}
            {!isAnswered&&<div style={{padding:'14px 20px',background:'#fffbeb',borderTop:'1px solid #fde68a'}}>
              <p style={{margin:'0 0 8px',fontSize:12,fontWeight:700,color:'#92400e'}}>✍️ Write Your Answer</p>
              <textarea value={answerState[d.id]||''} onChange={e=>setAns(p=>({...p,[d.id]:e.target.value}))} rows={3}
                placeholder="Type your response to the student…"
                style={{width:'100%',padding:'10px 12px',border:'1.5px solid #fde68a',borderRadius:9,fontSize:13,outline:'none',resize:'vertical',boxSizing:'border-box',fontFamily:'inherit',lineHeight:1.6,background:'#fff',transition:'border-color 0.2s'}}
                onFocus={e=>e.target.style.borderColor='#7c3aed'} onBlur={e=>e.target.style.borderColor='#fde68a'}/>
              <button onClick={()=>handleAnswer(d.id)} disabled={posting===d.id} style={{marginTop:8,display:'flex',alignItems:'center',gap:7,background:'linear-gradient(135deg,#7c3aed,#4f46e5)',color:'#fff',border:'none',borderRadius:9,padding:'10px 20px',fontWeight:700,fontSize:13,cursor:posting===d.id?'not-allowed':'pointer',opacity:posting===d.id?0.7:1}}>
                {posting===d.id?<><Spin/> Sending…</>:<><SendIcon size={14}/> Send Answer</>}
              </button>
            </div>}
          </div>;
        })}
      </div>}
    {toast&&<Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
  </div>;
}

// ════════════════════════════════════════════════════════════════════════════
// TEACHER: ASSIGNMENT PANEL  (with per-assignment submission viewer)
// ════════════════════════════════════════════════════════════════════════════
function TeacherAssignments(){
  const [assignments,setAssignments] = useState([]);
  const [subjectsList,setSL]         = useState([]);
  const [loading,setLoading]         = useState(false);
  const [posting,setPosting]         = useState(false);
  const [toast,setToast]             = useState(null);
  const [submissions,setSubmissions] = useState({});   // {asgId: []}
  const [openSubs,setOpenSubs]       = useState(null); // asgId
  const [form,setForm]               = useState({title:'',subject:'General',description:'',due_date:''});
  const [gradingId,setGradingId]     = useState(null);
  const [gradeForm,setGradeForm]     = useState({grade:'',feedback:''});
  const fileRef = useRef();
  const showToast=(msg,type='success')=>setToast({msg,type});

  const fetchAssignments=useCallback(async()=>{
    setLoading(true);
    try{ const r=await axios.get(`${API}/api/assignments`); setAssignments(r.data||[]); }
    catch{ showToast('Could not load assignments.','error'); }
    finally{ setLoading(false); }
  },[]);

  useEffect(()=>{ fetchAssignments(); axios.get(`${API}/api/subjects_list`).then(r=>setSL(r.data||[])).catch(()=>{}); },[]);

  const handlePost=async e=>{
    e.preventDefault();
    const file=fileRef.current?.files[0];
    if(!file){ showToast('Please attach a file.','error'); return; }
    if(!form.title.trim()){ showToast('Please enter a title.','error'); return; }
    setPosting(true);
    const fd=new FormData();
    Object.entries({title:form.title.trim(),subject:form.subject,description:form.description.trim(),due_date:form.due_date}).forEach(([k,v])=>fd.append(k,v));
    fd.append('file',file);
    try{ await axios.post(`${API}/api/assignments`,fd); showToast('✅ Assignment posted!'); setForm({title:'',subject:'General',description:'',due_date:''}); fileRef.current.value=''; fetchAssignments(); }
    catch(err){ showToast(err?.response?.data?.detail||'Post failed.','error'); }
    finally{ setPosting(false); }
  };

  const handleDelete=async(id,title)=>{
    if(!confirm(`Delete "${title}"?`)) return;
    try{ await axios.delete(`${API}/api/assignments/${id}`); showToast('Deleted.'); fetchAssignments(); }
    catch{ showToast('Delete failed.','error'); }
  };

  const loadSubmissions=async aId=>{
    if(openSubs===aId){ setOpenSubs(null); return; }
    setOpenSubs(aId);
    if(submissions[aId]) return;
    try{ const r=await axios.get(`${API}/api/assignments/${aId}/submissions`); setSubmissions(p=>({...p,[aId]:r.data})); }
    catch{ showToast('Could not load submissions.','error'); }
  };

  const handleGrade=async subId=>{
    try{
      await axios.put(`${API}/api/submissions/${subId}/grade`,gradeForm);
      showToast('✅ Grade saved!');
      setGradingId(null);
      // refresh submissions for current open assignment
      if(openSubs){ const r=await axios.get(`${API}/api/assignments/${openSubs}/submissions`); setSubmissions(p=>({...p,[openSubs]:r.data})); }
    }catch{ showToast('Grade save failed.','error'); }
  };

  const handleDeleteSub=async(subId,aId)=>{
    if(!confirm('Delete this submission?')) return;
    try{
      await axios.delete(`${API}/api/submissions/${subId}`);
      showToast('Submission deleted.');
      const r=await axios.get(`${API}/api/assignments/${aId}/submissions`);
      setSubmissions(p=>({...p,[aId]:r.data}));
    }catch{ showToast('Delete failed.','error'); }
  };

  return <div style={{padding:'22px 28px',overflowY:'auto',flex:1,display:'flex',flexDirection:'column',gap:20}}>
    <style>{GLOBAL_CSS}</style>
    <div style={{display:'flex',gap:22,flexWrap:'wrap',alignItems:'flex-start'}}>

      {/* ── Post form ── */}
      <div style={{flex:'0 0 360px',minWidth:280}}>
        <div style={{background:'linear-gradient(135deg,#1e3a8a,#4f46e5)',borderRadius:16,padding:'18px 22px',marginBottom:18}}>
          <h3 style={{margin:'0 0 4px',color:'#fff',fontSize:17,fontWeight:800,display:'flex',alignItems:'center',gap:8}}><PlusCircle size={18}/> Post New Assignment</h3>
          <p style={{margin:0,color:'#bfdbfe',fontSize:12}}>Students get instant notifications</p>
        </div>
        <form onSubmit={handlePost} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'20px',display:'flex',flexDirection:'column',gap:12}}>
          {[{k:'title',l:'Title *',ph:'e.g. Unit 3 Practice Problems',type:'text'},].map(f=>(
            <div key={f.k}>
              <label style={{fontSize:12,fontWeight:700,color:'#475569',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:0.5}}>{f.l}</label>
              <input value={form[f.k]} onChange={e=>setForm({...form,[f.k]:e.target.value})} placeholder={f.ph} type={f.type||'text'} style={{width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:14,outline:'none',boxSizing:'border-box',transition:'border-color 0.2s'}} onFocus={e=>e.target.style.borderColor='#4f46e5'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
            </div>
          ))}
          <div>
            <label style={{fontSize:12,fontWeight:700,color:'#475569',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:0.5}}>Subject</label>
            <select value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} style={{width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:14,outline:'none',background:'#fff',boxSizing:'border-box'}}>
              <option>General</option>{subjectsList.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:'#475569',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:0.5}}>Due Date</label>
            <input type="date" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} style={{width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:14,outline:'none',boxSizing:'border-box'}}/>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:'#475569',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:0.5}}>Description</label>
            <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={3} placeholder="Instructions, marks breakdown…" style={{width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,outline:'none',resize:'vertical',boxSizing:'border-box',fontFamily:'inherit',lineHeight:1.5}}/>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:'#475569',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:0.5}}>Attach File *</label>
            <label style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,padding:'18px',border:'2px dashed #e2e8f0',borderRadius:10,cursor:'pointer',background:'#f8fafc',transition:'all 0.2s'}} onMouseEnter={e=>{e.currentTarget.style.borderColor='#4f46e5';e.currentTarget.style.background='#eff6ff';}} onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.background='#f8fafc';}}>
              <Upload size={22} color='#94a3b8'/><span style={{fontSize:13,color:'#64748b',fontWeight:500}}>Click to attach any file</span>
              <input ref={fileRef} type="file" hidden/>
            </label>
          </div>
          <button type="submit" disabled={posting} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:'linear-gradient(135deg,#1e40af,#4f46e5)',color:'#fff',border:'none',borderRadius:10,padding:'13px',fontWeight:800,fontSize:15,cursor:posting?'not-allowed':'pointer',opacity:posting?0.7:1,boxShadow:'0 3px 10px rgba(79,70,229,0.35)'}}>
            {posting?<><Spin/> Posting…</>:<><PlusCircle size={16}/> Post Assignment</>}
          </button>
        </form>
      </div>

      {/* ── Posted assignments ── */}
      <div style={{flex:1,minWidth:280}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <h3 style={{margin:0,fontSize:16,fontWeight:800,color:'#1e293b',display:'flex',alignItems:'center',gap:8}}><ClipboardList size={17} color='#4f46e5'/> Posted <span style={{background:'#eff6ff',color:'#4f46e5',borderRadius:20,padding:'2px 10px',fontSize:12,fontWeight:700}}>{assignments.length}</span></h3>
          <button onClick={fetchAssignments} style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:9,padding:'7px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#64748b',fontWeight:600}}>
            <RefreshCw size={13} style={{animation:loading?'spin 1s linear infinite':'none'}}/> Refresh
          </button>
        </div>
        {loading ? <div style={{display:'flex',justifyContent:'center',padding:40}}><Spin/></div>
        : assignments.length===0 ? <div style={{textAlign:'center',padding:'40px 20px',background:'#f8fafc',borderRadius:14,border:'2px dashed #e2e8f0'}}><ClipboardList size={36} color='#cbd5e1' style={{marginBottom:10}}/><p style={{margin:0,color:'#94a3b8',fontSize:13}}>No assignments posted yet.</p></div>
        : <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {assignments.map(a=>(
              <div key={a.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden',borderLeft:`3px solid ${sc(a.subject).dot}`,animation:'fadeIn 0.25s ease'}}>
                <div style={{padding:'14px 18px',display:'flex',gap:12,alignItems:'flex-start'}}>
                  <div style={{width:38,height:38,borderRadius:9,background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><FileText size={18} color='#64748b'/></div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:'0 0 4px',fontWeight:700,color:'#1e293b',fontSize:14}}>{a.title}</p>
                    {a.description&&<p style={{margin:'0 0 6px',fontSize:12,color:'#64748b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.description}</p>}
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                      <SubjectTag subject={a.subject}/>
                      {a.due_date&&<span style={{fontSize:11,color:'#f97316',fontWeight:600,display:'flex',alignItems:'center',gap:3}}><Calendar size={11}/> {fmtDate(a.due_date)}</span>}
                      <span style={{fontSize:11,color:'#94a3b8'}}>{a.file_size_str}</span>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,flexShrink:0,alignItems:'center'}}>
                    <button onClick={()=>loadSubmissions(a.id)} style={{display:'flex',alignItems:'center',gap:5,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'6px 12px',cursor:'pointer',color:'#2563eb',fontSize:12,fontWeight:700}}>
                      <Inbox size={13}/> {a.submission_count} sub{a.submission_count!==1?'s':''}
                      {openSubs===a.id?<ChevronUp size={12}/>:<ChevronDown size={12}/>}
                    </button>
                    <button onClick={()=>handleDelete(a.id,a.title)} style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'6px 10px',cursor:'pointer',color:'#dc2626',display:'flex',alignItems:'center',gap:3,fontSize:12,fontWeight:600}}><Trash2 size={12}/> Del</button>
                  </div>
                </div>

                {/* Submissions panel */}
                {openSubs===a.id&&<div style={{borderTop:'1px solid #f1f5f9',background:'#f8fafc',padding:'14px 18px'}}>
                  <p style={{margin:'0 0 10px',fontSize:13,fontWeight:700,color:'#374151'}}>📥 Submissions ({(submissions[a.id]||[]).length})</p>
                  {!(submissions[a.id])||submissions[a.id].length===0 ? <p style={{margin:0,fontSize:13,color:'#94a3b8',fontStyle:'italic'}}>No submissions yet.</p>
                  : (submissions[a.id]||[]).map(sub=>(
                    <div key={sub.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,padding:'12px 14px',marginBottom:8}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                        <CheckSquare size={15} color='#22c55e'/>
                        <span style={{fontWeight:700,color:'#1e293b',fontSize:13}}>{sub.student_name}</span>
                        <span style={{fontSize:12,color:'#94a3b8'}}>{sub.original_name} · {sub.file_size_str}</span>
                        <span style={{fontSize:12,color:'#94a3b8'}}>{fmtTime(sub.submitted_at)}</span>
                        {sub.grade&&<span style={{background:'#dcfce7',color:'#15803d',borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700}}>Grade: {sub.grade}</span>}
                        <div style={{marginLeft:'auto',display:'flex',gap:6}}>
                          <button onClick={()=>window.open(`${API}/api/submissions/${sub.id}/download`,'_blank')} style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:7,padding:'5px 10px',cursor:'pointer',color:'#2563eb',display:'flex',alignItems:'center',gap:4,fontSize:12,fontWeight:600}}><Download size={12}/> Download</button>
                          <button onClick={()=>{setGradingId(gradingId===sub.id?null:sub.id);setGradeForm({grade:sub.grade||'',feedback:sub.feedback||''}); }} style={{background:'#fefce8',border:'1px solid #fde68a',borderRadius:7,padding:'5px 10px',cursor:'pointer',color:'#92400e',display:'flex',alignItems:'center',gap:4,fontSize:12,fontWeight:600}}><Award size={12}/> Grade</button>
                          <button onClick={()=>handleDeleteSub(sub.id,a.id)} style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:7,padding:'5px 8px',cursor:'pointer',color:'#dc2626',display:'flex',alignItems:'center'}}><Trash2 size={12}/></button>
                        </div>
                      </div>
                      {gradingId===sub.id&&<div style={{marginTop:10,padding:'12px',background:'#fefce8',borderRadius:9,border:'1px solid #fde68a'}}>
                        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:8}}>
                          <div style={{flex:'0 0 100px'}}>
                            <label style={{fontSize:11,fontWeight:700,color:'#475569',display:'block',marginBottom:4}}>GRADE</label>
                            <input value={gradeForm.grade} onChange={e=>setGradeForm(p=>({...p,grade:e.target.value}))} placeholder="A / 85 / Pass" style={{width:'100%',padding:'8px 10px',border:'1px solid #fde68a',borderRadius:7,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
                          </div>
                          <div style={{flex:1}}>
                            <label style={{fontSize:11,fontWeight:700,color:'#475569',display:'block',marginBottom:4}}>FEEDBACK</label>
                            <input value={gradeForm.feedback} onChange={e=>setGradeForm(p=>({...p,feedback:e.target.value}))} placeholder="Optional feedback for student…" style={{width:'100%',padding:'8px 10px',border:'1px solid #fde68a',borderRadius:7,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
                          </div>
                        </div>
                        <button onClick={()=>handleGrade(sub.id)} style={{display:'flex',alignItems:'center',gap:6,background:'linear-gradient(135deg,#92400e,#d97706)',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:700,fontSize:13,cursor:'pointer'}}><Award size={14}/> Save Grade</button>
                      </div>}
                      {sub.feedback&&gradingId!==sub.id&&<p style={{margin:'8px 0 0',fontSize:12,color:'#64748b',fontStyle:'italic'}}>💬 {sub.feedback}</p>}
                    </div>
                  ))}
                </div>}
              </div>
            ))}
          </div>}
      </div>
    </div>
    {toast&&<Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
  </div>;
}

// ════════════════════════════════════════════════════════════════════════════
// QUESTION ANALYZER (condensed, unchanged logic)
// ════════════════════════════════════════════════════════════════════════════
function QuestionsAnalyzer(){
  const [questions,setQuestions]=useState([]);
  const [subjects,setSubjects]=useState(['All']);
  const [subjectsList,setSL]=useState([]);
  const [papers,setPapers]=useState([]);
  const [stats,setStats]=useState({total_questions:0,total_papers:0,total_subjects:0,top_question:null});
  const [filter,setFilter]=useState('All');
  const [sort,setSort]=useState('probability');
  const [search,setSearch]=useState('');
  const [searchInput,setSearchInput]=useState('');
  const [page,setPage]=useState(1);
  const [totalPages,setTotalPages]=useState(1);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [toast,setToast]=useState(null);
  const [uploadResult,setUploadResult]=useState(null);
  const [manualSubject,setMS]=useState('');
  const [showPapers,setShowPapers]=useState(false);
  const fileRef=useRef();
  const showToast=(msg,type='success')=>setToast({msg,type});
  const fetchQ=useCallback(async(pg=page)=>{
    setLoading(true);
    try{
      const[qR,sR,pR,stR]=await Promise.all([
        axios.get(`${API}/api/questions`,{params:{subject:filter,search,sort,page:pg,per_page:20}}),
        axios.get(`${API}/api/subjects`),axios.get(`${API}/api/papers`),axios.get(`${API}/api/stats`),
      ]);
      setQuestions(qR.data.questions||[]);setTotal(qR.data.total||0);setTotalPages(qR.data.total_pages||1);
      setSubjects(['All',...(sR.data||[])]);setPapers(pR.data||[]);setStats(stR.data||{});
    }catch{showToast('Could not load data.','error');}finally{setLoading(false);}
  },[filter,search,sort,page]);
  useEffect(()=>{axios.get(`${API}/api/subjects_list`).then(r=>setSL(r.data||[])).catch(()=>{});},[]);
  useEffect(()=>{fetchQ(1);setPage(1);},[filter,search,sort]);
  useEffect(()=>{fetchQ(page);},[page]);
  const handleUpload=async e=>{
    const file=e.target.files[0];if(!file)return;
    if(!file.name.toLowerCase().endsWith('.pdf')){showToast('Only PDF files.','error');return;}
    setUploading(true);setUploadResult(null);
    const fd=new FormData();fd.append('file',file);fd.append('subject',manualSubject);
    try{const res=await axios.post(`${API}/api/upload-paper`,fd);setUploadResult(res.data);showToast(`✅ ${res.data.extracted} questions — ${res.data.new} new`);fetchQ(1);setPage(1);}
    catch(err){showToast(err?.response?.data?.detail||'Upload failed.','error');}
    finally{setUploading(false);fileRef.current.value='';}
  };
  return <div style={{display:'flex',flexDirection:'column',height:'100%',overflowY:'auto',padding:'22px 28px',gap:16}}>
    <style>{GLOBAL_CSS}</style>
    <div style={{background:'linear-gradient(135deg,#1e3a8a,#4f46e5)',borderRadius:16,padding:'18px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
      <div><h2 style={{margin:0,color:'#fff',fontSize:18,fontWeight:800}}>📊 Question Probability Analyzer</h2><p style={{margin:'3px 0 0',color:'#bfdbfe',fontSize:12}}>Upload past papers · TF-IDF scores exam likelihood</p></div>
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <select value={manualSubject} onChange={e=>setMS(e.target.value)} style={{padding:'8px 12px',borderRadius:8,border:'none',fontSize:12,background:'rgba(255,255,255,0.15)',color:'#fff',fontWeight:600,cursor:'pointer',outline:'none'}}>
          <option value="">Auto-detect</option>{subjectsList.map(s=><option key={s} value={s} style={{color:'#1e293b'}}>{s}</option>)}
        </select>
        <input ref={fileRef} type="file" accept=".pdf" hidden onChange={handleUpload} id="qa-up"/>
        <label htmlFor="qa-up" style={{display:'flex',alignItems:'center',gap:7,background:'#fff',color:'#1e40af',padding:'9px 18px',borderRadius:9,cursor:uploading?'not-allowed':'pointer',fontWeight:700,fontSize:13,whiteSpace:'nowrap',opacity:uploading?0.7:1,boxShadow:'0 2px 8px rgba(0,0,0,0.15)'}}>
          {uploading?<><Spin/> Processing…</>:<><Upload size={15}/> Upload Paper</>}
        </label>
      </div>
    </div>
    {uploadResult&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:12,padding:'12px 18px',display:'flex',gap:12,alignItems:'center'}}><CheckCircle size={18} color='#16a34a'/><div style={{flex:1}}><p style={{margin:0,fontWeight:700,color:'#15803d',fontSize:13}}>"{uploadResult.filename}" processed</p><p style={{margin:'2px 0 0',fontSize:12,color:'#166534'}}>{uploadResult.extracted} extracted · <strong>{uploadResult.subjects?.join(', ')}</strong> · {uploadResult.new} new · {uploadResult.merged} merged</p></div><button onClick={()=>setUploadResult(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#6b7280',padding:0}}><X size={15}/></button></div>}
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
      {[{i:<FileText/>,l:'Papers',v:stats.total_papers||0,c:'#2563eb'},{i:<Hash/>,l:'Questions',v:stats.total_questions||0,c:'#7c3aed'},{i:<Layers/>,l:'Subjects',v:stats.total_subjects||0,c:'#0891b2'}].map(x=>(
        <div key={x.l} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:'12px 18px',display:'flex',alignItems:'center',gap:12,minWidth:120}}>
          <div style={{width:34,height:34,borderRadius:9,background:x.c+'18',display:'flex',alignItems:'center',justifyContent:'center'}}>{React.cloneElement(x.i,{size:17,color:x.c})}</div>
          <div><p style={{margin:0,fontSize:18,fontWeight:800,color:'#1e293b'}}>{x.v}</p><p style={{margin:0,fontSize:11,color:'#94a3b8',fontWeight:600}}>{x.l}</p></div>
        </div>
      ))}
    </div>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
      <form onSubmit={e=>{e.preventDefault();setSearch(searchInput);setPage(1);}} style={{display:'flex',flex:1,minWidth:180,border:'1px solid #e2e8f0',borderRadius:9,overflow:'hidden',background:'#fff'}}>
        <input value={searchInput} onChange={e=>setSearchInput(e.target.value)} placeholder="Search questions…" style={{flex:1,padding:'8px 12px',border:'none',outline:'none',fontSize:13}}/>
        <button type="submit" style={{background:'#f1f5f9',border:'none',padding:'0 11px',cursor:'pointer'}}><Search size={14} color='#64748b'/></button>
      </form>
      <select value={sort} onChange={e=>setSort(e.target.value)} style={{padding:'8px 12px',border:'1px solid #e2e8f0',borderRadius:9,fontSize:13,color:'#374151',background:'#fff',outline:'none'}}>
        <option value="probability">By Probability</option><option value="frequency">By Frequency</option><option value="subject">By Subject</option>
      </select>
    </div>
    <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{subjects.map(s=><button key={s} onClick={()=>{setFilter(s);setPage(1);}} style={{padding:'5px 13px',borderRadius:20,fontWeight:600,fontSize:12,cursor:'pointer',border:`1px solid ${filter===s?'#2563eb':'#e2e8f0'}`,background:filter===s?'#2563eb':'#fff',color:filter===s?'#fff':'#475569',transition:'all 0.2s'}}>{s}</button>)}</div>
    {!loading&&<p style={{margin:0,fontSize:12,color:'#94a3b8',fontWeight:500}}>{total} question{total!==1?'s':''}{filter!=='All'?` in ${filter}`:''}</p>}
    {loading?<div style={{display:'flex',justifyContent:'center',padding:50}}><Spin/></div>
    :questions.length===0?<div style={{textAlign:'center',padding:'50px 30px',background:'#f8fafc',borderRadius:14,border:'2px dashed #e2e8f0'}}><BookOpen size={36} color='#cbd5e1' style={{marginBottom:12}}/><h3 style={{margin:'0 0 6px',color:'#374151',fontSize:16}}>{search||filter!=='All'?'No matching questions':'No Questions Yet'}</h3><p style={{margin:0,color:'#94a3b8',fontSize:13}}>{search||filter!=='All'?'Try a different filter.':'Upload a question paper PDF to get started.'}</p></div>
    :<div style={{display:'flex',flexDirection:'column',gap:9}}>{questions.map((q,i)=>{const c=sc(q.subject);return(<div key={q.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:11,padding:'15px 18px',borderLeft:`4px solid ${c.dot}`}}><div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}><span style={{minWidth:26,height:26,borderRadius:7,background:c.bg,color:c.text,border:`1px solid ${c.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,flexShrink:0}}>{(page-1)*20+i+1}</span><p style={{margin:0,color:'#1e293b',fontSize:14,lineHeight:1.6,fontWeight:500,flex:1}}>{q.text}</p><ScoreBadge score={q.probability}/></div><div style={{marginBottom:10}}><ProgressBar value={q.probability}/></div><div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><SubjectTag subject={q.subject}/><span style={{fontSize:11,color:'#94a3b8',display:'flex',alignItems:'center',gap:3}}><Clock size={10}/> {q.last_seen?.slice(0,10)||'—'}</span><span style={{fontSize:11,color:'#94a3b8',display:'flex',alignItems:'center',gap:3}}><Star size={10}/> {q.frequency}×</span></div></div>);})}</div>}
    {totalPages>1&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:10,padding:'10px 0'}}>
      <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:'7px 13px',cursor:page===1?'not-allowed':'pointer',opacity:page===1?0.5:1,display:'flex',alignItems:'center',gap:5,fontSize:13,fontWeight:600,color:'#475569'}}><ChevronLeft size={14}/> Prev</button>
      <span style={{fontSize:13,color:'#64748b',fontWeight:600}}>Page {page} / {totalPages}</span>
      <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:'7px 13px',cursor:page===totalPages?'not-allowed':'pointer',opacity:page===totalPages?0.5:1,display:'flex',alignItems:'center',gap:5,fontSize:13,fontWeight:600,color:'#475569'}}>Next <ChevronRight size={14}/></button>
    </div>}
    {toast&&<Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
  </div>;
}

// ════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [role,setRole]           = useState(null);
  const [creds,setCreds]         = useState({userid:'',password:''});
  const [loginError,setLE]       = useState('');
  const [activeTab,setActiveTab] = useState('chat');
  const [teacherTab,setTT]       = useState('assignment');
  const [prompt,setPrompt]       = useState('');
  const [messages,setMessages]   = useState([{role:'bot',text:'Hello! How can I help you with your exam preparation today?'}]);
  const [chatLoading,setCL]      = useState(false);
  const [teacherBusy,setTB]      = useState(false);
  // Notification state
  const [assignments,setAssignments]   = useState([]);
  const [myDoubts,setMyDoubts]         = useState([]);
  const [mySubmissions,setMySubmissions]= useState([]);
  const [seenIds,setSeenIds]           = useState(new Set());
  const [asgLoading,setAL]             = useState(false);

  // ── Polling ──────────────────────────────────────────────────────────────
  const fetchStudentData=useCallback(async()=>{
    setAL(true);
    try{
      const[aR,dR,sR]=await Promise.all([
        axios.get(`${API}/api/assignments`),
        axios.get(`${API}/api/doubts/student/${STUDENT}`),
        axios.get(`${API}/api/submissions/student/${STUDENT}`),
      ]);
      setAssignments(aR.data||[]);
      setMyDoubts(dR.data||[]);
      setMySubmissions(sR.data||[]);
    }catch{}finally{setAL(false);}
  },[]);

  useEffect(()=>{
    if(role==='student'){ fetchStudentData(); const id=setInterval(fetchStudentData,POLL_MS); return()=>clearInterval(id); }
  },[role,fetchStudentData]);

  const markSeen=ids=>setSeenIds(prev=>new Set([...prev,...ids]));

  // ── Auth ─────────────────────────────────────────────────────────────────
  const handleLogin=e=>{
    e.preventDefault();
    if(creds.userid==='admin'&&creds.password==='teacher123'){setRole('teacher');setLE('');}
    else if(creds.userid==='student'&&creds.password==='student123'){setRole('student');setLE('');}
    else setLE('Invalid User ID or Password');
  };

  const handleSend=async()=>{
    if(!prompt.trim())return;
    const msg={role:'user',text:prompt};
    setMessages(prev=>[...prev,msg]);setPrompt('');setCL(true);
    try{const res=await axios.post(`${API}/ask`,{prompt:msg.text});setMessages(prev=>[...prev,{role:'bot',text:res.data.response}]);}
    catch{setMessages(prev=>[...prev,{role:'bot',text:'Error: Could not reach the AI server.'}]);}
    finally{setCL(false);}
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  if(!role) return(
    <div className="login-screen"><style>{GLOBAL_CSS}</style>
      <div className="login-card" style={{animation:'fadeIn 0.4s ease'}}>
        <div style={{textAlign:'center',marginBottom:24}}><ShieldCheck size={46} color='#4f46e5'/><h1 style={{margin:'10px 0 4px',fontSize:22,color:'#1f2937'}}>AI College Portal</h1><p style={{margin:0,color:'#6b7280',fontSize:13}}>Enter your credentials to continue</p></div>
        <form onSubmit={handleLogin}>
          <div className="input-group"><label>User ID</label><input type="text" placeholder="Enter User ID" required onChange={e=>setCreds({...creds,userid:e.target.value})}/></div>
          <div className="input-group"><label>Password</label><input type="password" placeholder="••••••••" required onChange={e=>setCreds({...creds,password:e.target.value})}/></div>
          {loginError&&<p className="error-msg">{loginError}</p>}
          <button type="submit" className="login-submit-btn">Sign In</button>
        </form>
        <p style={{margin:'16px 0 0',fontSize:11,color:'#94a3b8',textAlign:'center'}}>student / student123 &nbsp;·&nbsp; admin / teacher123</p>
      </div>
    </div>
  );

  // ── Teacher ───────────────────────────────────────────────────────────────
  if(role==='teacher'){
    const TTABS=[
      {k:'assignment',icon:<PlusCircle size={16}/>,l:'Add Assignment'},
      {k:'doubts',    icon:<Inbox size={16}/>,      l:'Student Doubts'},
      {k:'material',  icon:<Upload size={16}/>,      l:'Upload Material'},
    ];
    return(
      <div className="app-container"><style>{GLOBAL_CSS}</style>
        <header className="header" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <h1 style={{margin:0}}>Teacher Dashboard</h1>
          <button className="logout-btn" onClick={()=>setRole(null)}><LogOut size={16}/> Logout</button>
        </header>
        <div style={{display:'flex',gap:0,padding:'0 28px',borderBottom:'1px solid #e2e8f0',background:'#fff'}}>
          {TTABS.map(t=><button key={t.k} onClick={()=>setTT(t.k)} style={{display:'flex',alignItems:'center',gap:7,padding:'12px 20px',border:'none',borderBottom:`2px solid ${teacherTab===t.k?'#4f46e5':'transparent'}`,background:'none',cursor:'pointer',fontWeight:700,fontSize:14,color:teacherTab===t.k?'#4f46e5':'#6b7280',transition:'all 0.2s',whiteSpace:'nowrap'}}>{t.icon}{t.l}</button>)}
        </div>
        <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          {teacherTab==='assignment'&&<TeacherAssignments/>}
          {teacherTab==='doubts'&&<TeacherDoubts/>}
          {teacherTab==='material'&&<div className="teacher-content"><div className="upload-box"><h2>Upload Academic Material</h2><p>Add PDF notes or Previous Year Papers to the Knowledge Base.</p><input type="file" id="pdf-upload" hidden onChange={async e=>{const file=e.target.files[0];if(!file)return;const fd=new FormData();fd.append('file',file);setTB(true);try{await axios.post(`${API}/api/upload`,fd);alert('✅ File uploaded!');}catch{alert('❌ Upload failed.');}finally{setTB(false);}}}/><label htmlFor="pdf-upload" className="big-upload-btn"><Upload size={40}/><span>{teacherBusy?'Uploading…':'Click to Upload PDF'}</span></label></div></div>}
        </div>
      </div>
    );
  }

  // ── Student ────────────────────────────────────────────────────────────────
  const unseenAsg    = assignments.filter(a=>!seenIds.has(a.id));
  const answeredQ    = myDoubts.filter(d=>d.status==='answered'&&!seenIds.has('d'+d.id));
  const notifCount   = unseenAsg.length+answeredQ.length;

  const STABS=[
    {k:'chat',        icon:<MessageSquare size={17}/>, l:'Chat Assistant'},
    {k:'predictor',   icon:<TrendingUp size={17}/>,    l:'Question Analyzer'},
    {k:'assignments', icon:<ClipboardList size={17}/>, l:'Assignments',   badge:unseenAsg.length||null},
    {k:'doubts',      icon:<HelpCircle size={17}/>,    l:'Ask Teacher',   badge:answeredQ.length||null},
  ];

  return(
    <div className="app-container" style={{height:'95vh'}}><style>{GLOBAL_CSS}</style>
      <header className="header" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <h1 style={{margin:0}}>AI Assistance</h1>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <NotificationBell assignments={assignments} seenIds={seenIds} doubts={myDoubts} onMarkSeen={markSeen} onTabOpen={setActiveTab}/>
          <button className="logout-btn" onClick={()=>setRole(null)}><LogOut size={16}/> Logout</button>
        </div>
      </header>
      <div className="tab-container">
        {STABS.map(t=>(
          <button key={t.k} className={`tab-button ${activeTab===t.k?'active':''}`} style={{position:'relative'}}
            onClick={()=>{ setActiveTab(t.k); if(t.k==='assignments')markSeen(assignments.map(a=>a.id)); if(t.k==='doubts')markSeen(myDoubts.filter(d=>d.status==='answered').map(d=>'d'+d.id)); }}>
            {t.icon} {t.l}
            {t.badge&&<span style={{position:'absolute',top:-6,right:-6,background:'#ef4444',color:'#fff',borderRadius:'50%',width:18,height:18,fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid #fff'}}>{t.badge>9?'9+':t.badge}</span>}
          </button>
        ))}
      </div>
      <main style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {activeTab==='chat'&&<div className="chat-section" style={{margin:20,height:'calc(100% - 40px)'}}><div className="message-list">{messages.map((m,i)=><div key={i} className={`message-bubble ${m.role}`}>{m.text}</div>)}{chatLoading&&<div className="message-bubble bot typing"><span className="dot"/><span className="dot"/><span className="dot"/></div>}</div><div className="input-area"><input value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleSend()} placeholder="Type your question…"/><button onClick={handleSend} className="send-btn"><Send size={18}/> Send</button></div></div>}
        {activeTab==='predictor'&&<QuestionsAnalyzer/>}
        {activeTab==='assignments'&&<StudentAssignments assignments={assignments} seenIds={seenIds} onMarkSeen={markSeen} loading={asgLoading} mySubmissions={mySubmissions} onSubmitted={fetchStudentData}/>}
        {activeTab==='doubts'&&<StudentDoubts seenIds={seenIds} onMarkSeen={markSeen}/>}
      </main>
    </div>
  );
}
