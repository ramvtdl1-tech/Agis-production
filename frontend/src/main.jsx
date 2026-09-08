import React,{useEffect,useMemo,useState}from"react";
import{createRoot}from"react-dom/client";
import{BrowserRouter,NavLink,Route,Routes,useNavigate,useParams}from"react-router-dom";
import{Bell,ChevronDown,ChevronLeft,ChevronRight,Eye,FileText,Home,LockKeyhole,LogIn,Menu,MoreVertical,Plus,RefreshCw,Search,Settings,Shield,ShieldCheck,Sparkles,Upload,Users,Workflow,CheckCircle2,Clock3,Download,Copy,Edit3,Filter,SlidersHorizontal,Database,FileCog,KeyRound,LogOut,Archive,Info,ArrowRight,ArrowLeft,BarChart3,UserRound,CircleAlert,CalendarDays,Globe2,Languages,Target,AlignLeft,PanelTop,Save,ExternalLink,Trash2}from"lucide-react";
import{api}from"./api";import"./styles.css";

const docsMock=[
 {id:1,name:"Situation Report.pdf",type:"PDF",size:"2.4 MB",status:"Ready",created:"Today, 10:30 AM"},
 {id:2,name:"Technical Report.docx",type:"DOCX",size:"1.8 MB",status:"Processing",created:"Yesterday, 04:15 PM"},
 {id:3,name:"Field Report.pdf",type:"PDF",size:"3.1 MB",status:"Transformed",created:"Yesterday, 09:20 AM"},
 {id:4,name:"Data Summary.xlsx",type:"XLSX",size:"0.9 MB",status:"Ready",created:"2 days ago, 11:45 AM"},
 {id:5,name:"Research Report.pdf",type:"PDF",size:"4.2 MB",status:"Ready",created:"3 days ago, 02:30 PM"}
];
const recentMock=[
 {name:"Situation Report.pdf",output:"Executive Summary",status:"For Review",created:"Today, 10:30 AM"},
 {name:"Technical Report.docx",output:"Intelligence Brief",status:"Approved",created:"Yesterday, 04:15 PM"},
 {name:"Field Report.pdf",output:"Advisory",status:"Processing",created:"Today, 09:20 AM"}
];
const VISUAL_TEST_USER={id:1,name:"Admin User",username:"admin",role:"Administrator"};
const roles=["Administrator","Approver","Reviewer","Operator","Viewer","Auditor","Data Manager","Guest"];
const perms=["Dashboard","Documents","Transformations","Generated Outputs","Review & Approval","Audit Logs","System Configuration","User Management"];
const outputTypes=[
 ["Executive Summary","Concise summary for leadership and decision makers.",FileText],
 ["Intelligence Brief","Actionable insights and key intelligence points.",Sparkles],
 ["Advisory / Notice","Formal advisory or notice communication.",Workflow],
 ["Analytical Report","In-depth analysis with structured findings.",BarChart3],
 ["Other","Custom output based on your requirements.",FileCog]
];

function Badge({children,tone}){const v=String(children);return <span className={`badge ${tone||v.toLowerCase().replaceAll(" ","-")}`}>{v}</span>}
function IconBox({children,tone="blue"}){return <span className={`icon-box ${tone}`}>{children}</span>}
function Button({children,variant="primary",...p}){return <button className={`btn ${variant}`} {...p}>{children}</button>}
function Card({children,className=""}){return <section className={`card ${className}`}>{children}</section>}
function PageTitle({title,sub,actions,crumb}){return <div className="page-title"><div>{crumb&&<div className="crumb">{crumb}</div>}<h1>{title}</h1><p>{sub}</p></div><div className="title-actions">{actions}</div></div>}
function Stepper({step}){return <div className="stepper">{[[1,"Select Source"],[2,"Configure"],[3,"Review"]].map(([n,l],i)=><React.Fragment key={n}><div className={`step ${step>=n?"done":""} ${step===n?"current":""}`}><span>{step>n?<CheckCircle2 size={15}/>:n}</span><b>{l}</b></div>{i<2&&<div className={`step-line ${step>n?"done":""}`}/>}</React.Fragment>)}</div>}

function Sidebar({user}){const main=[["/dashboard","Dashboard",Home],["/documents","Documents",FileText],["/transformations","Transformations",RefreshCw],["/audit-logs","Audit Logs",Workflow]];const admin=[["/users","User Management",Users],["/roles","Roles & Permissions",ShieldCheck],["/system","System Configuration",SlidersHorizontal],["/templates","Template Management",FileCog]];return <aside className="sidebar"><div className="brand"><div className="brand-mark"><Shield size={18}/></div><div><strong>AGIS</strong><span>Adaptive GenAI<br/>Intelligence System</span></div></div><nav><div className="nav-label">Workspace</div>{main.map(([to,label,I])=><NavLink key={to} to={to} className={({isActive})=>`nav-item ${isActive?"active":""}`}><I size={16}/><span>{label}</span></NavLink>)}<div className="nav-label admin-label">Settings</div>{user?.role==="Administrator"&&admin.map(([to,label,I])=><NavLink key={to} to={to} className={({isActive})=>`nav-item sub ${isActive?"active":""}`}><I size={15}/><span>{label}</span></NavLink>)}</nav><div className="secure-box"><ShieldCheck size={16}/><div><b>Secure. Controlled. Reliable.</b><span>All content is encrypted and access is role-based.</span></div></div></aside>}
const RoleAvatar=({user,className=""})=>{
  const role=user?.role||"Operator";

  if(role==="Administrator"){
    return <div className={`avatar ${className}`}><ShieldCheck size={17}/></div>;
  }

  if(role==="Reviewer"){
    return <div className={`avatar ${className}`}><Eye size={17}/></div>;
  }

  if(role==="Operator"){
    return <div className={`avatar ${className}`}><Workflow size={17}/></div>;
  }

  return <div className={`avatar ${className}`}><UserRound size={17}/></div>;
};

function Topbar({user}){
  const [profileOpen,setProfileOpen]=useState(false);
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  const navigate=useNavigate();

  const logout=()=>{
    localStorage.removeItem("agis_access");
    localStorage.removeItem("agis_draft");
    sessionStorage.clear();
    setProfileOpen(false);
    setNotificationsOpen(false);
    navigate("/");
    window.location.reload();
  };

  return (
    <header className="topbar">
      <div className="mobile-menu">
        <Menu size={19}/>
      </div>

      <div className="top-actions">

        {/* Notifications */}
        <div className="notification-wrap">
          <button
            type="button"
            className="bell"
            onClick={()=>{
              setNotificationsOpen(v=>!v);
              setProfileOpen(false);
            }}
            aria-label="Notifications"
          >
            <Bell size={18}/>
            <i/>
          </button>

          {notificationsOpen && (
            <div className="notification-menu">
              <div className="dropdown-head">
                <b>Notifications</b>
                <span>2 new</span>
              </div>

              <div className="notification-item">
                <span className="notification-dot blue"/>
                <div>
                  <b>Transformation ready</b>
                  <small>Your generated output is ready for review.</small>
                </div>
              </div>

              <div className="notification-item">
                <span className="notification-dot green"/>
                <div>
                  <b>System active</b>
                  <small>AGIS is running normally.</small>
                </div>
              </div>

              <div className="notification-footer">
                <button type="button">
                  Mark all as read
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="profile-wrap">
          <button
            type="button"
            className="profile"
            onClick={()=>{
              setProfileOpen(v=>!v);
              setNotificationsOpen(false);
            }}
          >
            <RoleAvatar user={user}/>

            <div>
              <b>{user?.name||"Operator"}</b>
              <span>
                {user?.role||"Operator"} · <em>Active</em>
              </span>
            </div>

            <ChevronDown
              size={15}
              className={profileOpen?"rotate-chevron":""}
            />
          </button>

          {profileOpen && (
            <div className="profile-menu">

              <div className="profile-menu-user">
                <RoleAvatar user={user} className="large"/>

                <div>
                  <b>{user?.name||"Operator"}</b>
                  <span>{user?.email||""}</span>
                </div>
              </div>

              <div className="dropdown-divider"/>

              <button
                type="button"
                onClick={()=>{
                  setProfileOpen(false);
                  navigate("/profile");
                }}
              >
                <UserRound size={16}/>
                <span>My Profile</span>
              </button>

              <button
                type="button"
                onClick={()=>{
                  setProfileOpen(false);
                  navigate("/profile");
                }}
              >
                <KeyRound size={16}/>
                <span>Change Password</span>
              </button>

              <div className="dropdown-divider"/>

              <button
                type="button"
                className="logout-item"
                onClick={logout}
              >
                <LogOut size={16}/>
                <span>Logout</span>
              </button>

            </div>
          )}
        </div>

      </div>
    </header>
  );
}
function Shell({user,children}){return <div className="app-shell"><Sidebar user={user}/><div className="content-shell"><Topbar user={user}/><main>{children}</main></div></div>}

function Login({done,showRegister}){
  const [f,setF]=useState({
    username:"operator",
    password:"change-me",
    role:"Operator"
  });

  const [cid,setCid]=useState(null);
  const [code,setCode]=useState(["","","","","",""]);
  const [err,setErr]=useState("");

  const submit=async e=>{
    e.preventDefault();
    setErr("");

    try{
      if(!cid){
        const r=await api.login(f);
        setCid(r.challenge_id);
      }else{
        const r=await api.otp({
          challenge_id:cid,
          code:code.join("")
        });

        localStorage.agis_access=r.access_token;
        done(r.user);
      }
    }catch(x){
      setErr(x.message);
    }
  };

  return (
    <div className="login-page">

      <div className="login-hero">
        <div className="hero-inner">

          <div className="hero-brand">
            <strong>AGIS</strong>
            <span>Adaptive GenAI Intelligence System</span>
          </div>

          <div className="hero-sub">
            Secure AI Workspace
          </div>

          <div className="hero-line"/>

          <div className="shield-visual">
            <Shield size={112}/>
            <LockKeyhole className="lock" size={58}/>
          </div>

        </div>
      </div>

      <div className="login-panel">

        <form className="login-card" onSubmit={submit}>

          <div className="login-icon">
            <ShieldCheck size={30}/>
          </div>

          <h1>
            {cid ? "Verify your identity" : "Welcome to AGIS"}
          </h1>

          <p>
            {cid
              ? "Enter the 6-digit OTP sent to your registered email/mobile."
              : "Please sign in to continue"}
          </p>

          {!cid && (
            <>
              <label>
                Username
                <div className="input-wrap">
                  <UserRound size={17}/>
                  <input
                    placeholder="Enter your username"
                    value={f.username}
                    onChange={e =>
                      setF({...f,username:e.target.value})
                    }
                  />
                </div>
              </label>

              <label>
                Password
                <div className="input-wrap">
                  <LockKeyhole size={17}/>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={f.password}
                    onChange={e =>
                      setF({...f,password:e.target.value})
                    }
                  />
                </div>
              </label>

              <label>
                Select Your Role

                <div className="role-picks">
                  {[
                    ["Operator",Shield],
                    ["Reviewer",Users],
                    ["Administrator",BarChart3]
                  ].map(([r,I]) => (
                    <button
                      type="button"
                      className={f.role===r ? "selected" : ""}
                      onClick={() => setF({...f,role:r})}
                      key={r}
                    >
                      <I size={22}/>
                      <b>{r}</b>
                    </button>
                  ))}
                </div>
              </label>

              <label className="remember">
                <input type="checkbox"/>
                Remember me
              </label>
            </>
          )}

          {cid && (
            <div className="otp-block">

              <b>Enter OTP</b>

              <div className="otp-row">
                {code.map((v,i) => (
                  <input
                    key={i}
                    maxLength="1"
                    autoFocus={i===0}
                    value={v}
                    onChange={e => {
                      const a=[...code];
                      a[i]=e.target.value.replace(/\D/g,"");
                      setCode(a);

                      if(a[i] && i<5){
                        e.target.nextElementSibling?.focus();
                      }
                    }}
                  />
                ))}
              </div>

              <div className="otp-meta">
                <span>
                  OTP sent to registered email/mobile
                </span>
                <a href="#">
                  Resend OTP (00:30)
                </a>
              </div>

            </div>
          )}

          {err && (
            <div className="error">
              {err}
            </div>
          )}

          <Button className="login-btn">
            {cid ? (
              <>
                <LogIn size={17}/>
                Verify & Sign In
              </>
            ) : (
              <>
                <LogIn size={17}/>
                Login
              </>
            )}
          </Button>

          {!cid && (
            <div className="register-link">
              <span>Don't have an account?</span>

              <button
                type="button"
                onClick={showRegister}
              >
                Register
              </button>
            </div>
          )}

        </form>

      </div>

    </div>
  );
}


function Register({back}){
  const [form,setForm]=useState({
    name:"",
    username:"",
    email:"",
    mobile:"",
    password:"",
    role:"Operator"
  });

  const [challengeId,setChallengeId]=useState(null);
  const [code,setCode]=useState(["","","","","",""]);
  const [message,setMessage]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);

  const submit=async e=>{
    e.preventDefault();
    setErr("");
    setMessage("");
    setLoading(true);

    try{
      if(!challengeId){
        const r=await api.register(form);
        setChallengeId(r.challenge_id);
        setMessage(r.message);
      }else{
        const r=await api.registerOtp({
          challenge_id:challengeId,
          code:code.join("")
        });

        setMessage(r.message);
      }
    }catch(x){
      setErr(x.message);
    }finally{
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
  <div className="login-hero">
    <div className="hero-inner">
      <div className="hero-brand">
        <strong>AGIS</strong>
        <span>Adaptive GenAI Intelligence System</span>
      </div>

      <div className="hero-sub">Secure AI Workspace</div>

      <div className="hero-line"/>

      <div className="shield-visual">
        <Shield size={112}/>
        <LockKeyhole className="lock" size={58}/>
      </div>
    </div>
  </div>

  <div className="login-panel">
    <div className="login-card"></div>
        {!challengeId ? (
          <form onSubmit={submit}>

            <h2>Create Account</h2>

            <label>Name</label>
            <input
              value={form.name}
              onChange={e=>setForm({...form,name:e.target.value})}
              required
            />

            <label>Username</label>
            <input
              value={form.username}
              onChange={e=>setForm({...form,username:e.target.value})}
              required
            />

            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e=>setForm({...form,email:e.target.value})}
              required
            />

            <label>Mobile</label>
            <input
              value={form.mobile}
              onChange={e=>setForm({...form,mobile:e.target.value})}
              required
            />

            <label>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={e=>setForm({...form,password:e.target.value})}
              required
            />

            <label>Role</label>
            <select
              value={form.role}
              onChange={e=>setForm({...form,role:e.target.value})}
            >
              <option value="Operator">Operator</option>
              <option value="Reviewer">Reviewer</option>
              <option value="Administrator">Administrator</option>
            </select>

            {err && <div className="error">{err}</div>}

            <button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Account"}
            </button>

          </form>
        ) : (
          <form onSubmit={submit}>

            <h2>Verify OTP</h2>

            <p>
              Enter the 6-digit verification code sent to your email.
            </p>

            <div className="otp-inputs">
              {code.map((v,i)=>(
                <input
                  key={i}
                  maxLength={1}
                  value={v}
                  onChange={e=>{
                    const next=[...code];
                    next[i]=e.target.value.replace(/\D/g,"");
                    setCode(next);
                  }}
                  required
                />
              ))}
            </div>

            {err && <div className="error">{err}</div>}
            {message && <div className="success">{message}</div>}

            <button type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Verify OTP"}
            </button>

          </form>
        )}

        <button
          type="button"
          className="secondary-button"
          onClick={back}
        >
          Back to Login
        </button>

      </div>
    </div>
  );
}

function Dashboard({user}){
  const[d,setD]=useState(null);

  useEffect(() => {
    let alive = true;

    api.dashboard()
      .then(data => {
        if (alive) setD(data);
      })
      .catch(() => {
        if (alive) setD({});
      });

    return () => {
      alive = false;
    };
  }, []);

  const indiaHour=Number(
    new Intl.DateTimeFormat("en-IN",{
      timeZone:"Asia/Kolkata",
      hour:"2-digit",
      hourCycle:"h23"
    }).format(new Date())
  );

  const greeting=
    indiaHour>=5 && indiaHour<12
      ? "Good Morning"
      : indiaHour>=12 && indiaHour<17
        ? "Good Afternoon"
        : "Good Evening";

  const counts=d?.counts||{};

  return <><PageTitle title={`${greeting}, ${user?.role||"Operator"}`} sub="Welcome to our secure AI workspace." actions={<NavLink className="btn primary" to="/transformations/new"><Plus size={17}/>New Transformation</NavLink>}/><div className="stat-grid">{[["Documents",counts.documents??0,FileText,"blue"],["Processed",counts.processed??0,Sparkles,"blue"],["For Review",counts.for_review??0,Users,"amber"],["Approved",counts.approved??0,ShieldCheck,"green"]].map(([l,n,I,t])=><Card className="stat-card" key={l}><IconBox tone={t}><I size={20}/></IconBox><div><span>{l}</span><strong>{n}</strong></div></Card>)}</div><div className="content-grid dashboard-grid"><Card className="table-card"><div className="card-head"><div><h2>Recent Transformations</h2></div><NavLink to="/transformations">View all <ChevronRight size={15}/></NavLink></div><Table><thead><tr><th>Document</th><th>Output</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{(d?.recent||[]).length ? (d.recent.map(x=><tr key={x.id}><td><FileText size={15}/> {x.name}</td><td>{x.output_type||"—"}</td><td><Badge>{x.status}</Badge></td><td>{new Date(x.created_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</td><td><NavLink to={`/transformations/${x.id}`} className="blue-link"><Eye size={15}/> View</NavLink></td></tr>)) : <tr><td colSpan="5">No transformations yet.</td></tr>}</tbody></Table></Card><Card className="quick-card"><div className="card-head"><h2>Quick Actions</h2></div>{[[Upload,"Upload Document","/documents","blue"],[RefreshCw,"New Transformation","/transformations/new","blue"],[Users,"Review Outputs","/transformations","green"]].map(([I,l,to,t])=><NavLink className="quick-action" to={to} key={l}><IconBox tone={t}><I size={19}/></IconBox><b>{l}</b><ChevronRight size={16}/></NavLink>)}</Card></div><Card className="workflow-card"><div className="card-head"><h2>AGIS Workflow</h2></div><div className="workflow">{[[FileText,"SOURCE","blue"],[Sparkles,"TRANSFORM","blue"],[ShieldCheck,"VALIDATE","green"],[UserRound,"REVIEW","gray"],[Download,"EXPORT","gray"]].map(([I,l,t],i)=><React.Fragment key={l}><div className="workflow-step"><IconBox tone={t}><I size={19}/></IconBox><b>{l}</b></div>{i<4&&<ArrowRight size={17} className="workflow-arrow"/>}</React.Fragment>)}</div></Card></>}

function Table({children}){return <div className="table-wrap"><table>{children}</table></div>}
function Toolbar({searchText="Search...",children}){return <div className="toolbar"><div className="search"><Search size={16}/><input placeholder={searchText}/></div><div className="filters">{children}</div></div>}
function Documents(){const[d,setD]=useState([]);useEffect(() => {
  let alive = true;

  api.documents()
    .then(data => {
      if (alive) setD(data);
    })
    .catch(() => {});

  return () => {
    alive = false;
  };
}, []);const rows=d.length?d.map(x=>({name:x.name,type:x.mime_type?.includes("word")?"DOCX":x.mime_type?.includes("sheet")?"XLSX":"PDF",size:(x.size_bytes/1048576).toFixed(1)+" MB",status:x.status||x.extraction_status,created:new Date(x.created_at).toLocaleString()})):docsMock;async function up(e){if(e.target.files[0]){await api.upload(e.target.files[0]);const r=await api.documents();setD(r)}}return <><PageTitle title="Documents" sub="Manage and organize organizational content for secure GenAI transformation." actions={<label className="btn primary"><Plus size={17}/>Upload Document<input hidden type="file" accept=".pdf,.docx,.xlsx" onChange={up}/></label>}/><Card><Toolbar searchText="Search documents..."><Button variant="select">All Status <ChevronDown size={14}/></Button><Button variant="select">All Types <ChevronDown size={14}/></Button><Button variant="select"><Filter size={14}/> Filters</Button></Toolbar><Table><thead><tr><th>Document</th><th>Type</th><th>Status</th><th>Owner</th><th>Created</th><th>Actions</th></tr></thead><tbody>{rows.map(x=><tr key={x.name}><td><div className="doc-cell"><IconBox tone={x.type.toLowerCase()}><FileText size={17}/></IconBox><div><b>{x.name}</b><span>{x.size}</span></div></div></td><td><Badge tone={x.type.toLowerCase()}>{x.type}</Badge></td><td><Badge>{x.status}</Badge></td><td><span className="owner"><span>OP</span>Operator</span></td><td>{x.created}</td><td className="row-actions"><Eye size={15}/><RefreshCw size={15}/><MoreVertical size={16}/></td></tr>)}</tbody></Table><div className="table-foot"><span>Showing 1 to 5 of 24 documents</span><Pager/></div></Card><div className="notice"><ShieldCheck size={19}/><div><b>Secure. Controlled. Compliant.</b><span>All documents are encrypted and access is controlled based on your role permissions.</span></div><a href="#">Learn more <ExternalLink size={13}/></a></div></>}
function Pager(){return <div className="pager"><button><ChevronLeft size={15}/></button><button className="active">1</button><button>2</button><button>3</button><span>…</span><button>5</button><button><ChevronRight size={15}/></button></div>}

function NewTransformation(){const[d,setD]=useState(docsMock),[selected,setSelected]=useState(1),[type,setType]=useState("Executive Summary"),n=useNavigate();useEffect(() => {
  let alive = true;

  api.documents()
    .then(r => {
      if (!alive || !r.length) return;

      setD(r.map(x => ({
        id: x.id,
        name: x.name,
        type: x.mime_type?.includes("word")
          ? "DOCX"
          : x.mime_type?.includes("sheet")
            ? "XLSX"
            : "PDF",
        size: (x.size_bytes / 1048576).toFixed(1) + " MB",
        status: x.status || "Ready",
        created: new Date(x.created_at).toLocaleString()
      })));
    })
    .catch(() => {});

  return () => {
    alive = false;
  };
}, []);return <><PageTitle title="New Transformation" sub="Select a source document and choose the type of output you want to generate." crumb={<><NavLink to="/documents">Documents</NavLink><ChevronRight size={13}/>New Transformation</>} actions={<Stepper step={1}/>} /><Card><h2>1. Select Source Document</h2><p className="section-sub">Choose a document from your library to transform.</p><Toolbar searchText="Search documents..."><Button variant="select">All Types <ChevronDown size={14}/></Button></Toolbar><Table><thead><tr><th></th><th>Document</th><th>Type</th><th>Size</th><th>Uploaded</th><th>Status</th><th>Action</th></tr></thead><tbody>{d.map(x=><tr key={x.id} className={selected===x.id?"selected-row":""}><td><input type="radio" checked={selected===x.id} onChange={()=>setSelected(x.id)}/></td><td><div className="doc-cell"><IconBox tone={String(x.type).toLowerCase()}><FileText size={16}/></IconBox><b>{x.name}</b></div></td><td><Badge tone={String(x.type).toLowerCase()}>{x.type}</Badge></td><td>{x.size}</td><td>{x.created}</td><td><Badge>{x.status}</Badge></td><td className="blue-link"><Eye size={15}/> Preview</td></tr>)}</tbody></Table></Card><Card><h2>2. Select Output Type</h2><p className="section-sub">Choose the type of content you want to generate.</p><div className="output-grid">{outputTypes.map(([name,desc,I])=><button key={name} className={`output-card ${type===name?"selected":""}`} onClick={()=>setType(name)}><span className="radio-dot">{type===name&&<i/>}</span><IconBox tone="blue"><I size={18}/></IconBox><b>{name}</b><span>{desc}</span></button>)}</div><div className="form-actions"><Button variant="secondary">Cancel</Button><Button onClick={()=>{localStorage.agis_draft=JSON.stringify({document_id:selected,output_type:type});n("/transformations/config")}}>Continue to Configure <ArrowRight size={16}/></Button></div></Card></>}
function Configuration(){
  let draft = {};

  try {
    draft = JSON.parse(localStorage.agis_draft || "{}");
  } catch {
    localStorage.removeItem("agis_draft");
    draft = {};
  };const[f,setF]=useState({target_audience:"Leadership / Decision Makers",tone:"Formal & Objective",language:"English",detail_level:"Concise",objective:"Inform",content_style:"Structured (Section-wise)",...draft});const n=useNavigate();const save=async()=>{try{const r=await api.createTransformation({...f,document_id:Number(f.document_id)});localStorage.removeItem("agis_draft");n("/transformations/"+r.id)}catch(e){localStorage.agis_draft=JSON.stringify(f);n("/transformations/output/mock")}};return <><PageTitle title="Configure Transformation" sub="Define how the content should be transformed using GenAI." crumb={<><NavLink to="/transformations">Transformations</NavLink><ChevronRight size={13}/><span>New Transformation</span><ChevronRight size={13}/>Configure</>} actions={<Stepper step={2}/>} /><div className="content-grid config-layout"><Card><h2>Transformation Settings</h2><div className="source-summary"><div><span>Source Document</span><b>📄 Situation Report.pdf</b><small>PDF · 2.4 MB</small></div><button>Change</button><div><span>Output Type</span><b>🟩 {f.output_type||"Executive Summary"}</b><small>Concise summary for leadership</small></div><button>Change</button></div><div className="config-fields">{[["target_audience","1. Target Audience",Users],["tone","2. Tone",Sparkles],["language","3. Language",Languages],["detail_level","4. Detail Level",BarChart3],["objective","5. Communication Objective",Target],["content_style","6. Content Style",AlignLeft]].map(([k,l,I])=><label key={k}><span>{l}</span><div className="select-field"><I size={15}/><input value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})}/><ChevronDown size={14}/></div><small>{k==="target_audience"?"Tailor content for senior leadership and policy makers.":k==="tone"?"Maintain a formal and objective tone.":k==="language"?"Select the language for the output.":k==="detail_level"?"Short and to-the-point summary.":k==="objective"?"Objective of the communication.":"Organized in clear sections and headings."}</small></label>)}</div><button className="advanced"><SlidersHorizontal size={15}/> Advanced Options (Optional)<ChevronDown size={15}/></button><div className="form-actions"><Button variant="secondary">Cancel</Button><Button variant="secondary"><Save size={15}/>Save as Draft</Button><Button onClick={save}><Sparkles size={15}/>Generate Output <ArrowRight size={15}/></Button></div></Card><div className="side-stack"><Card><h3>Source Document Preview</h3><div className="mini-doc"><b>SITUATION REPORT</b><small>Flood Impact Assessment - North Region</small><hr/><b>1. Overview</b><p>Heavy rainfall in the last 48 hours has caused significant flooding in multiple districts.</p><b>2. Key Highlights</b><p>• Over 12,000 people affected<br/>• Roads and bridges damaged<br/>• Relief operations underway</p></div><div className="mini-doc-foot">1 / 6 <span>−　+　⛶</span></div></Card><Card><h3>Transformation Summary</h3>{[[Target,"Output Type",f.output_type],[Users,"Target Audience",f.target_audience],[Languages,"Language",f.language],[BarChart3,"Detail Level",f.detail_level]].map(([I,l,v])=><div className="summary-row" key={l}><I size={15}/><div><span>{l}</span><b>{v}</b></div></div>)}<a className="blue-link">View all settings <ArrowRight size={13}/></a></Card><div className="notice compact"><ShieldCheck size={18}/><span>All transformations are secure, logged and role-controlled.</span></div></div></div></>}

function Output(){const{id}=useParams();const[t,setT]=useState(null);useEffect(() => {
  let alive = true;

  if (id !== "mock") {
    api.transformation(id)
      .then(data => {
        if (alive) setT(data);
      })
      .catch(() => {
        if (alive) {
          setT({
            status: "Ready for Review",
            output_type: "Executive Summary",
            output: ""
          });
        }
      });
  } else {
    setT({
      status: "Ready for Review",
      output_type: "Executive Summary",
      output: ""
    });
  }

  return () => {
    alive = false;
  };
}, [id]);const output=t?.output||"Executive Summary\nSource: Situation Report.pdf\nDate: 24 May 2025\n\nOverview\nThis situation report provides an update on the flood impact assessment in the North Region. Heavy rainfall over the past 48 hours has caused severe disruptions across multiple districts, affecting infrastructure, transportation, and agriculture.\n\nKey Impact\n• Over 12,000 people affected across 18 locations.\n• Roads and bridges damaged in 18 locations, disrupting connectivity.\n• Relief operations are underway with local and national administration.\n• IMD has predicted more rainfall in the next 24–48 hours.\n\nAssessment\nInfrastructure damage is significant in low-lying areas. Immediate focus should be on relief distribution, restoring essential services, and preparing for further weather events.\n\nRecommendations\n• Prioritize relief to affected communities.\n• Ensure availability of medical facilities and safe shelters.\n• Strengthen early warning and communication.\n• Plan for infrastructure restoration in phases.";return <><PageTitle title="Generated Output & Validation" sub="Review the generated content and validate before submission." crumb={<><NavLink to="/transformations">Transformations</NavLink><ChevronRight size={13}/>New Transformation<ChevronRight size={13}/>Configure<ChevronRight size={13}/>Output</>} /><div className="content-grid output-layout"><div><div className="success-banner"><CheckCircle2 size={19}/><div><b>Output generated successfully!</b><span>Review the generated content and validate before submission.</span></div><Button variant="outline">View Audit Trail</Button></div><Card className="editor-card"><div className="editor-head"><div><h2>Generated Output <Badge tone="green">Executive Summary</Badge></h2><span>Generated on 24 May 2025, 11:45 AM</span></div><div><Button variant="secondary"><Download size={15}/>Download</Button><Button variant="secondary"><Copy size={15}/>Copy</Button></div></div><div className="editor-toolbar"><span>Normal⌄</span><span>↶　↷</span><span>100%⌄</span><span>⛶</span></div><article className="generated-doc">{output.split("\n").map((x,i)=><p key={i} className={i===0?"doc-title":/^(Overview|Key Impact|Assessment|Recommendations)$/.test(x)?"doc-section":""}>{x||"\u00a0"}</p>)}</article></Card><div className="bottom-actions"><Button variant="secondary"><ArrowLeft size={15}/>Back to Configuration</Button><Button variant="secondary"><Settings size={15}/>Edit Configuration</Button><NavLink className="btn primary" to={`/transformations/${id}/review`}>Proceed to Review <ArrowRight size={15}/></NavLink></div></div><OutputSidebar/></div></>}
function OutputSidebar(){return <div className="side-stack"><Card><div className="card-head"><h3>Transformation Summary</h3><a className="blue-link"><Edit3 size={13}/> Edit</a></div>{[[FileText,"Source Document","Situation Report.pdf"],[FileCog,"Output Type","Executive Summary"],[Users,"Target Audience","Leadership / Decision Makers"],[Sparkles,"Tone","Formal & Objective"],[Languages,"Language","English"],[BarChart3,"Detail Level","Concise"],[CalendarDays,"Generated On","24 May 2025, 11:45 AM"]].map(([I,l,v])=><div className="summary-row" key={l}><IconBox tone="soft"><I size={14}/></IconBox><div><span>{l}</span><b>{v}</b></div></div>)}</Card><Card><h3>Validation Checks</h3>{["Content Generated","Required Sections","Length Check","Sensitive Content","Format Check"].map(x=><div className="validation" key={x}><div><b>{x}</b><span>{x==="Content Generated"?"Output generated successfully":x==="Required Sections"?"All key sections included":x==="Length Check"?"Summary length is appropriate":x==="Sensitive Content"?"No sensitive content detected":"Formatting and structure valid"}</span></div><CheckCircle2 size={16}/></div>)}</Card><div className="notice compact"><ShieldCheck size={18}/><span>This output is AI-generated. Please review before submission.</span></div></div>}

function Review(){const{id}=useParams();const[t,setT]=useState({status:"Ready for Review"}),[decision,setDecision]=useState("Approve"),[comment,setComment]=useState(""),[saved,setSaved]=useState(false);useEffect(() => {
  let alive = true;

  if (id !== "mock") {
    api.transformation(id)
      .then(data => {
        if (alive) setT(data);
      })
      .catch(() => {});
  }

  return () => {
    alive = false;
  };
}, [id]);async function submit(){if(id!=="mock")await api.review(id,{decision,comment});setSaved(true)}return <><PageTitle title="Review & Approval" sub="Validate the generated content and record the decision." crumb={<><NavLink to="/transformations">Transformations</NavLink><ChevronRight size={13}/>New Transformation<ChevronRight size={13}/>Configure<ChevronRight size={13}/>Output<ChevronRight size={13}/>Review</>} /><div className="content-grid output-layout"><div><div className="success-banner"><CheckCircle2 size={19}/><div><b>Ready for Review</b><span>The output has been generated and is ready for your review and approval.</span></div><Button variant="outline">View Full Output <ExternalLink size={13}/></Button></div><Card><div className="review-summary-head"><div><h2>Generated Output Summary <Badge tone="green">Executive Summary</Badge></h2><span>From: Situation Report.pdf　·　Generated on: 24 May 2025, 11:45 AM　·　By: Operator</span></div></div><div className="summary-text">Heavy rainfall over the past 48 hours has caused significant flooding in multiple districts across the North Region. Over 12,000 people are affected. Roads and bridges in 18 locations are damaged, impacting connectivity and relief operations. Immediate relief distribution and infrastructure restoration are critical priorities.</div><div className="metrics"><span>Length: ~ 620 words</span><span>Sections: 5</span><span>Language: English</span><span>Tone: Formal & Objective</span></div><h3 className="decision-title">Review Decision <em>*</em></h3><p className="section-sub">Please review the generated output and take appropriate action.</p><div className="decision-grid">{[["Approve","Output is accurate, complete and ready for use.",CheckCircle2,"green"],["Request Changes","Output needs modifications before approval.",Edit3,"amber"],["Reject","Output is not suitable and requires regeneration.",CircleAlert,"red"]].map(([d,s,I,t])=><button key={d} className={`decision-card ${decision===d?"selected "+t:""}`} onClick={()=>setDecision(d)}><span className="radio-dot">{decision===d&&<i/>}</span><IconBox tone={t}><I size={18}/></IconBox><b>{d}</b><span>{s}</span></button>)}</div><label className="comments"><span>Review Comments (Optional)</span><textarea maxLength={1000} placeholder="Write your comments here..." value={comment} onChange={e=>setComment(e.target.value)}/><small>{comment.length} / 1000</small></label><div className="form-actions"><Button variant="secondary"><ArrowLeft size={15}/>Back to Output</Button><Button variant="secondary"><Save size={15}/>Save as Draft</Button><Button onClick={submit}>Submit Decision <ChevronDown size={15}/></Button></div>{saved&&<div className="success-banner mini"><CheckCircle2 size={16}/>Decision saved: {decision}</div>}</Card></div><div className="side-stack"><Card><h3>Transformation Details</h3>{[[FileText,"Source Document","Situation Report.pdf"],[FileCog,"Output Type","Executive Summary"],[Users,"Target Audience","Leadership / Decision Makers"],[UserRound,"Generated By","Operator"],[CalendarDays,"Generated On","24 May 2025, 11:45 AM"]].map(([I,l,v])=><div className="summary-row" key={l}><IconBox tone="soft"><I size={14}/></IconBox><div><span>{l}</span><b>{v}</b></div></div>)}</Card><Card><h3>Validation Results</h3>{["Content Generated","Required Sections","Length Check","Sensitive Content","Format Check"].map(x=><div className="validation" key={x}><div><b>{x}</b><span>All checks passed</span></div><CheckCircle2 size={16}/></div>)}</Card><Card><h3>Activity History</h3><div className="timeline"><div><i/><b>Output generated</b><span>By Operator · 24 May 2025, 11:45 AM</span></div><div><i/><b>Submitted for review</b><span>By Operator · 24 May 2025, 11:46 AM</span></div><div><i/><b>Review pending</b><span>Waiting for your decision</span></div></div></Card><div className="notice compact"><ShieldCheck size={18}/><span>Your review decision will be logged and visible to authorized roles.</span></div></div></div></>}

function AuditLogs(){
  const[logs,setLogs]=useState([]);
  const[selectedLog,setSelectedLog]=useState(null);

  useEffect(()=>{
    let alive=true;

    const loadLogs=async()=>{
      try{
        const data=await api.logs();
        if(alive){
          const rows=Array.isArray(data)?data:[];
          setLogs(rows);
          setSelectedLog(rows[0]||null);
        }
      }catch(e){
        if(alive){
          setLogs([]);
          setSelectedLog(null);
        }
      }
    };

    loadLogs();

    return()=>{
      alive=false;
    };
  },[]);

  const rows=logs;

  const totalActivities=rows.length;

  const uniqueUsers=new Set(
    rows
      .map(x=>x.user_id)
      .filter(Boolean)
  ).size;

  const failedActions=rows.filter(x=>
    /(fail|error|denied|rejected)/i.test(
      `${x.action||""} ${x.details||""}`
    )
  ).length;

  const successfulActions=Math.max(
    totalActivities-failedActions,
    0
  );

  const formatTimestamp=(value)=>{
    if(!value)return "—";

    const date=new Date(value);

    if(Number.isNaN(date.getTime())){
      return value;
    }

    return date.toLocaleString("en-IN",{
      day:"2-digit",
      month:"short",
      year:"numeric",
      hour:"2-digit",
      minute:"2-digit",
    });
  };

  return (
    <>
      <PageTitle
        title="Audit Logs"
        sub="Track and review all system activities."
        actions={
          <Button variant="secondary">
            <Download size={15}/>
            Export Logs
          </Button>
        }
      />

      <div className="content-grid audit-layout">
        <Card>
          <Toolbar searchText="Search by action, user, document...">
            <Button variant="select">
              <CalendarDays size={14}/>
              All Loaded Logs
              <ChevronDown size={13}/>
            </Button>

            <Button variant="select">
              All Roles
              <ChevronDown size={13}/>
            </Button>

            <Button variant="select">
              All Actions
              <ChevronDown size={13}/>
            </Button>

            <Button variant="select">
              <Filter size={14}/>
              Filters
            </Button>
          </Toolbar>

          <Table>
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Details</th>
                <th>IP Address</th>
              </tr>
            </thead>

            <tbody>
              {rows.length===0?(
                <tr>
                  <td colSpan="7">
                    <div style={{padding:"24px",textAlign:"center"}}>
                      No audit logs available.
                    </div>
                  </td>
                </tr>
              ):(
                rows.map((x,i)=>(
                  <tr
                    key={x.id||i}
                    onClick={()=>setSelectedLog(x)}
                    style={{cursor:"pointer"}}
                  >
                    <td>{formatTimestamp(x.timestamp)}</td>

                    <td>
                      <div className="user-cell">
                        <span>
                          {String(x.user||"S")[0].toUpperCase()}
                        </span>

                        <div>
                          <b>{x.user||"System"}</b>
                          <small>
                            {x.email||x.username||"—"}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <Badge tone="role">
                        {x.role||"—"}
                      </Badge>
                    </td>

                    <td>{x.action||"—"}</td>
                    <td>{x.resource||"—"}</td>
                    <td>{x.details||"—"}</td>
                    <td>{x.ip_address||"—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>

          <div className="table-foot">
            <span>
              Showing {rows.length?1:0} to {rows.length} of {rows.length} loaded entries
            </span>
            <Pager/>
          </div>
        </Card>

        <div className="side-stack">
          <Card>
            <h3>Log Details</h3>

            {selectedLog?(
              [
                [
                  Clock3,
                  "Time",
                  formatTimestamp(selectedLog.timestamp)
                ],
                [
                  UserRound,
                  "User",
                  selectedLog.user||"System"
                ],
                [
                  Shield,
                  "Role",
                  selectedLog.role||"—"
                ],
                [
                  Workflow,
                  "Action",
                  selectedLog.action||"—"
                ],
                [
                  FileText,
                  "Resource",
                  selectedLog.resource||"—"
                ],
                [
                  Info,
                  "Details",
                  selectedLog.details||"—"
                ],
                [
                  Database,
                  "IP Address",
                  selectedLog.ip_address||"—"
                ],
                [
                  KeyRound,
                  "Log ID",
                  String(selectedLog.id||"—")
                ]
              ].map(([I,l,v])=>(
                <div className="summary-row" key={l}>
                  <I size={15}/>
                  <div>
                    <span>{l}</span>
                    <b>{v}</b>
                  </div>
                </div>
              ))
            ):(
              <div className="summary-row">
                <Info size={15}/>
                <div>
                  <span>Selection</span>
                  <b>No log selected</b>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h3>Summary (This Period)</h3>

            {[
              ["Total Activities",String(totalActivities)],
              ["Unique Users",String(uniqueUsers)],
              ["Successful Actions",String(successfulActions)],
              ["Failed Actions",String(failedActions)]
            ].map(([l,v])=>(
              <div className="period-row" key={l}>
                <span>{l}</span>
                <b>{v}</b>
              </div>
            ))}

            <a className="blue-link">
              View Analytics
              <ArrowRight size={13}/>
            </a>
          </Card>

          <div className="notice compact">
            <ShieldCheck size={18}/>
            <span>
              All activities are securely logged and tamper-protected.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function UsersPage(){
  const [users,setUsers]=useState([]);
  const [tab,setTab]=useState("Users");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(null);
  const [error,setError]=useState("");

  const loadUsers=async()=>{
    setLoading(true);
    setError("");

    try{
      const data=await api.users();
      setUsers(Array.isArray(data)?data:[]);
    }catch(e){
      setError(e.message||"Unable to load users");
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{
    loadUsers();
  },[]);

  const handleApproval=async(userId,action)=>{
    setBusy(userId);
    setError("");

    try{
      if(action==="approve"){
        const result=await api.requestApprovalOTP(userId);
        window.alert(
          `Approval OTP sent to the Reviewer's registered email.\n\nChallenge ID: ${result.challenge_id}\n\nThe Reviewer must enter this OTP to complete approval.`
        );
      }else{
        await api.approveUser(userId,action);
        await loadUsers();
      }
    }catch(e){
      setError(e.message||"Approval request failed");
    }finally{
      setBusy(null);
    }
  };

  const pendingUsers=users.filter(
    u=>u.approval_status==="Pending"
  );

  const activeUsers=users.filter(
    u=>u.active===true
  );

  const inactiveUsers=users.filter(
    u=>u.active!==true
  );

  const roleCounts=users.reduce((acc,u)=>{
    acc[u.role]=(acc[u.role]||0)+1;
    return acc;
  },{});

  return (
    <>
      <PageTitle
        title="User Management"
        sub="Manage users, roles, and access across the AGIS platform."
        actions={
          <Button
            variant="secondary"
            onClick={loadUsers}
            disabled={loading}
          >
            <RefreshCw size={15}/>
            {loading?"Refreshing...":"Refresh"}
          </Button>
        }
      />

      <div className="tabs">
        <button
          className={tab==="Users"?"active":""}
          onClick={()=>setTab("Users")}
        >
          Users
        </button>

        <button
          className={tab==="Roles"?"active":""}
          onClick={()=>setTab("Roles")}
        >
          Roles
        </button>

        <button
          className={tab==="Permissions"?"active":""}
          onClick={()=>setTab("Permissions")}
        >
          Permissions
        </button>

        <button
          className={tab==="Access Requests"?"active":""}
          onClick={()=>setTab("Access Requests")}
        >
          Access Requests
          {pendingUsers.length>0 && (
            <Badge tone="pending">
              {pendingUsers.length}
            </Badge>
          )}
        </button>
      </div>

      {error && (
        <div className="notice compact">
          <CircleAlert size={18}/>
          <span>{error}</span>
        </div>
      )}

      {tab==="Access Requests" ? (
        <Card>
          <div className="card-head">
            <div>
              <h2>Access Requests</h2>
              <p className="section-sub">
                Review registrations requiring Administrator approval.
              </p>
            </div>

            <Button
              variant="outline"
              onClick={loadUsers}
              disabled={loading}
            >
              <RefreshCw size={14}/>
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="empty-state">
              Loading access requests...
            </div>
          ) : pendingUsers.length===0 ? (
            <div className="empty-state">
              <CheckCircle2 size={24}/>
              <b>No pending access requests</b>
              <span>All registration requests have been processed.</span>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Verification</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {pendingUsers.map(u=>(
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <span>
                          {String(u.name||u.username||"U")
                            .split(" ")
                            .map(x=>x[0])
                            .join("")
                            .slice(0,3)
                            .toUpperCase()}
                        </span>

                        <div>
                          <b>{u.name||u.username}</b>
                          <small>@{u.username}</small>
                        </div>
                      </div>
                    </td>

                    <td>{u.email||"—"}</td>

                    <td>
                      <Badge tone="role">
                        {u.role}
                      </Badge>
                    </td>

                    <td>
                      <div className="request-verification">
                        <span>
                          Email {u.email_verified?"Verified":"Pending"}
                        </span>
                        <span>
                          Mobile {u.mobile_verified?"Verified":"Pending"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <Badge tone="pending">
                        Pending
                      </Badge>
                    </td>

                    <td>
                      <div className="row-actions">
                        <Button
                          onClick={()=>handleApproval(u.id,"approve")}
                          disabled={busy===u.id}
                        >
                          <CheckCircle2 size={14}/>
                          {busy===u.id?"Sending OTP...":"Send Approval OTP"}
                        </Button>

                        <Button
                          variant="danger"
                          onClick={()=>handleApproval(u.id,"reject")}
                          disabled={busy===u.id}
                        >
                          <Trash2 size={14}/>
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : tab==="Users" ? (
        <>
          <div className="stat-grid five">

            <Card className="mini-stat">
              <IconBox tone="blue">
                <Users size={18}/>
              </IconBox>
              <div>
                <span>Total Users</span>
                <strong>{users.length}</strong>
                <small>Registered accounts</small>
              </div>
            </Card>

            <Card className="mini-stat">
              <IconBox tone="green">
                <CheckCircle2 size={18}/>
              </IconBox>
              <div>
                <span>Active Users</span>
                <strong>{activeUsers.length}</strong>
                <small>Approved and active</small>
              </div>
            </Card>

            <Card className="mini-stat">
              <IconBox tone="purple">
                <Users size={18}/>
              </IconBox>
              <div>
                <span>Inactive Users</span>
                <strong>{inactiveUsers.length}</strong>
                <small>Inactive accounts</small>
              </div>
            </Card>

            <Card className="mini-stat">
              <IconBox tone="amber">
                <ShieldCheck size={18}/>
              </IconBox>
              <div>
                <span>Roles</span>
                <strong>{Object.keys(roleCounts).length}</strong>
                <small>Assigned roles</small>
              </div>
            </Card>

            <Card className="mini-stat">
              <IconBox tone="blue">
                <KeyRound size={18}/>
              </IconBox>
              <div>
                <span>Pending Requests</span>
                <strong>{pendingUsers.length}</strong>
                <small>Need approval</small>
              </div>
            </Card>

          </div>

          <div className="content-grid admin-grid">

            <Card>

              <div className="card-head">
                <div>
                  <h2>Users</h2>
                  <p className="section-sub">
                    All registered AGIS users.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="empty-state">
                  Loading users...
                </div>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Approval</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {users.map(u=>(
                      <tr key={u.id}>

                        <td>
                          <div className="user-cell">
                            <span>
                              {String(u.name||u.username||"U")
                                .split(" ")
                                .map(x=>x[0])
                                .join("")
                                .slice(0,3)
                                .toUpperCase()}
                            </span>

                            <div>
                              <b>{u.name||u.username}</b>
                              <small>{u.username}</small>
                            </div>
                          </div>
                        </td>

                        <td>{u.email||"—"}</td>

                        <td>
                          <Badge tone="role">
                            {u.role}
                          </Badge>
                        </td>

                        <td>
                          <Badge
                            tone={
                              String(u.approval_status||"Approved")
                                .toLowerCase()
                            }
                          >
                            {u.approval_status||"Approved"}
                          </Badge>
                        </td>

                        <td>
                          <Badge
                            tone={u.active?"active":"inactive"}
                          >
                            {u.active?"Active":"Inactive"}
                          </Badge>
                        </td>

                        <td className="row-actions">

                          {u.approval_status==="Pending" ? (
                            <>
                              <Button
                                onClick={()=>handleApproval(u.id,"approve")}
                                disabled={busy===u.id}
                              >
                                <CheckCircle2 size={14}/>
                                Approve
                              </Button>

                              <Button
                                variant="danger"
                                onClick={()=>handleApproval(u.id,"reject")}
                                disabled={busy===u.id}
                              >
                                Reject
                              </Button>
                            </>
                          ) : (
                            <Eye size={15}/>
                          )}

                        </td>

                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}

              <div className="table-foot">
                <span>
                  Showing {users.length} users
                </span>
                <Button
                  variant="outline"
                  onClick={loadUsers}
                >
                  <RefreshCw size={14}/>
                  Refresh
                </Button>
              </div>

            </Card>

            <div className="side-stack">

              <Card>
                <h3>Role Distribution</h3>

                {Object.keys(roleCounts).length===0 ? (
                  <p className="section-sub">
                    No users found.
                  </p>
                ) : (
                  Object.entries(roleCounts)
                    .sort((a,b)=>b[1]-a[1])
                    .map(([role,count])=>(
                      <div
                        className="legend-row"
                        key={role}
                      >
                        <i/>
                        <span>{role}</span>
                        <b>{count}</b>
                      </div>
                    ))
                )}
              </Card>

              <Card>

                <div className="card-head">
                  <h3>Recent Access Requests</h3>

                  <button
                    className="blue-link"
                    onClick={()=>setTab("Access Requests")}
                  >
                    View All
                    <ArrowRight size={13}/>
                  </button>
                </div>

                {pendingUsers.length===0 ? (
                  <div className="empty-state compact">
                    <CheckCircle2 size={20}/>
                    <span>No pending requests</span>
                  </div>
                ) : (
                  pendingUsers.map(u=>(
                    <div
                      className="request"
                      key={u.id}
                    >
                      <IconBox tone="blue">
                        <KeyRound size={14}/>
                      </IconBox>

                      <div>
                        <b>{u.email||u.username}</b>
                        <span>
                          {u.role} Access
                        </span>
                      </div>

                      <Badge tone="pending">
                        Pending
                      </Badge>
                    </div>
                  ))
                )}

              </Card>

              <div className="notice compact">
                <ShieldCheck size={18}/>
                <span>
                  All user actions are logged and access is role-controlled.
                </span>
              </div>

            </div>

          </div>
        </>
      ) : (
        <Card>
          <h2>{tab}</h2>
          <p className="section-sub">
            This section is available from the User Management module.
          </p>
        </Card>
      )}
    </>
  );
}

function RolesPage(){const[selected,setSelected]=useState("Administrator");const matrix=useMemo(()=>({Administrator:[1,1,1,1,1,1,1],Approver:[1,0,1,0,1,1,0],Reviewer:[1,0,1,0,1,1,0],Operator:[1,1,1,0,0,1,0]}),[]);return <><PageTitle title="Roles & Permissions" sub="Manage roles and configure permissions for platform resources."/><div className="tabs"><b>Roles</b><span>Permissions</span></div><div className="roles-layout"><Card className="roles-list"><div className="card-head"><h3>Roles (8)</h3><Button variant="outline"><Plus size={14}/> Add Role</Button></div><div className="search compact-search"><Search size={15}/><input placeholder="Search roles..."/></div>{roles.map((r,i)=><button key={r} className={`role-item ${selected===r?"active":""}`} onClick={()=>setSelected(r)}><IconBox tone={["purple","green","blue","blue","gray","amber","teal","amber"][i]}><Users size={16}/></IconBox><div><b>{r}</b><span>{i===0?"Full system access and control":i===1?"Review and approve outputs":i===2?"Review and provide feedback":i===3?"Create and manage transformations":i===4?"View documents and outputs":i===5?"View audit logs and reports":i===6?"Manage documents and data":"Limited readonly access"}</span></div><small>{[12,8,34,62,12,5,3,2][i]} Users</small></button>)}</Card><Card className="permission-panel"><div className="card-head"><div><h2>Role Details</h2><div className="role-detail"><IconBox tone="purple"><ShieldCheck size={20}/></IconBox><div><b>{selected}</b><Badge tone="green">System Role</Badge><span>Full system access and control over all modules and configurations.</span></div></div></div><Button variant="outline"><Edit3 size={14}/> Edit Role</Button></div><div className="role-meta"><span><Users size={15}/> Users <b>12</b></span><span><CalendarDays size={15}/> Created On <b>01 Mar 2025</b></span><span><UserRound size={15}/> Created By <b>System</b></span><span><CalendarDays size={15}/> Last Updated <b>20 May 2025, 10:30 AM</b></span></div><div className="info-strip"><Info size={16}/> Permissions define what actions users in this role can perform.</div><Table><thead><tr><th>Module / Resource</th><th>View</th><th>Create</th><th>Edit</th><th>Delete</th><th>Approve</th><th>Export</th><th>Configure</th></tr></thead><tbody>{perms.map((p,i)=><tr key={p}><td><b>{p}</b><small>{i===0?"View dashboards and insights":i===1?"Upload, view and manage documents":i===2?"Create and manage transformations":i===3?"View and manage generated outputs":i===4?"Review and approve outputs":i===5?"View audit logs and activity":i===6?"Manage system configurations":"Manage users and roles"}</small></td>{[0,1,2,3,4,5,6].map((_,j)=><td key={j}><span className={`perm ${selected==="Administrator"?"yes":(matrix[selected]||matrix.Reviewer)[j]?"yes":j===2||j===3?"limited":"no"}`}>{selected==="Administrator"?"✓":(matrix[selected]||matrix.Reviewer)[j]?"✓":j===2||j===3?"−":"×"}</span></td>)}</tr>)}</tbody></Table><div className="form-actions"><div className="notice compact"><ShieldCheck size={18}/>Changes to permissions are applied in real-time and logged in Audit Logs.</div><Button variant="secondary">Cancel</Button><Button><Save size={15}/>Save Changes</Button></div></Card></div></>}

function SystemPage(){return <><PageTitle title="System Configuration" sub="Configure system settings and platform preferences."/><div className="tabs"><b>General Settings</b><span>Security</span><span>AI & Model Settings</span><span>Integrations</span><span>Notifications</span><span>Data Management</span></div><div className="content-grid system-layout"><div className="settings-grid">{[["Platform Settings",[["Platform Name","Adaptive GenAI Intelligence System (AGIS)"],["Default Language","English"],["Default Timezone","(UTC +05:30) Asia/Kolkata"]]],["Document & Transformation Settings",[["Default Output Type","Executive Summary"],["Default Detail Level","Standard"],["Auto Expiry of Documents","90 Days"]]],["Display Settings",[["Theme","Light"],["Date Format","24 May 2025 (DD MMM YYYY)"],["Items Per Page","10"]]],["Notification Preferences",[["Email Notifications","Receive email alerts for system activities"],["In-App Notifications","Show in-app notifications"],["Transformation Alerts","Alerts for completed transformations"],["Audit Log Alerts","Critical activity alerts"]]],["File & Storage Settings",[["Max File Size","50 MB"],["Allowed File Types","PDF, DOCX, TXT, PPTX"],["Storage Quota (Per User)","10 GB"]]],["Session & Access Settings",[["Session Timeout","30 Minutes"],["Multi-Factor Authentication","Protected"],["Concurrent Sessions (Per User)","3"]]]].map(([title,fields])=><Card key={title}><h3>{title}</h3><p className="section-sub">Configure defaults and preferences</p>{fields.map(([l,v])=><label className="setting-row" key={l}><span>{l}</span>{["Email Notifications","In-App Notifications","Transformation Alerts","Audit Log Alerts","Multi-Factor Authentication"].includes(l)?<div className={`toggle ${l==="Audit Log Alerts"?"off":""}`}><i/></div>:<div className="setting-input">{v}<ChevronDown size={13}/></div>}</label>)}<Button variant="outline"><Save size={14}/>Save Changes</Button></Card>)}</div><div className="side-stack"><Card><h3>System Information</h3>{[["AGIS Version","v2.1.0"],["Build Number","2025.05.24.01"],["Environment","Production"],["Database Status","Healthy"],["Last Backup","24 May 2025, 02:30 AM"],["Uptime","15d 6h 42m"]].map(([l,v])=><div className="period-row" key={l}><span>{l}</span><b className={l==="Database Status"?"green-text":""}>{v}</b></div>)}</Card><Card><h3>Configuration Summary</h3>{[["Total Configurations","42"],["Active Configurations","38"],["Modified Today","5"],["Pending Changes","0"]].map(([l,v])=><div className="period-row" key={l}><span>{l}</span><b>{v}</b></div>)}</Card><Card><div className="card-head"><h3>Recent Configuration Changes</h3><a>View All</a></div>{["AI model updated to GPT-4o","Session timeout changed","Storage quota updated"].map((x,i)=><div className="change" key={x}><IconBox tone={["purple","blue","green"][i]}>{i+1}</IconBox><div><b>{x}</b><span>By Administrator<br/>24 May 2025, {11-i}:30 AM</span></div></div>)}</Card><div className="notice compact"><ShieldCheck size={18}/><span>All configuration changes are logged and require appropriate permissions.</span></div></div></div></>}

function TemplatesPage(){return <><PageTitle title="Template Management" sub="Create, manage, and organize templates for content transformation." actions={<Button><Plus size={16}/>Create Template</Button>}/><div className="tabs"><b>Templates</b><span>Categories</span></div><div className="stat-grid four">{[["Total Templates","48",FileText,"blue"],["Active Templates","36",CheckCircle2,"green"],["Draft Templates","6",Clock3,"amber"],["Archived Templates","6",Archive,"purple"]].map(([l,n,I,t])=><Card className="mini-stat" key={l}><IconBox tone={t}><I size={18}/></IconBox><div><span>{l}</span><strong>{n}</strong><small>{l==="Total Templates"?"All templates in system":l==="Active Templates"?"Currently available":l==="Draft Templates"?"In draft":"Not in use"}</small></div></Card>)}</div><div className="content-grid template-layout"><Card><Toolbar searchText="Search templates by name, category or tag..."><Button variant="select">All Categories <ChevronDown size={13}/></Button><Button variant="select">All Status <ChevronDown size={13}/></Button><Button variant="select">All Created By <ChevronDown size={13}/></Button><Button variant="select"><Filter size={14}/> Filters</Button></Toolbar><Table><thead><tr><th>Template Name</th><th>Category</th><th>Output Type</th><th>Audience</th><th>Status</th><th>Version</th><th>Updated On</th><th>Actions</th></tr></thead><tbody>{[["Executive Summary Template","Reports","Executive Summary","Leadership","Active","v2.1","24 May 2025, 11:30 AM"],["Technical Brief Template","Briefs","Technical Brief","Technical Team","Active","v1.4","23 May 2025, 04:15 PM"],["Intelligence Note Template","Notes","Intelligence Note","Analyst","Draft","v0.9","22 May 2025, 10:05 AM"],["Situation Report Template","Reports","Situation Report","Leadership","Active","v3.0","21 May 2025, 09:20 AM"],["Operational Update Template","Updates","Operational Update","Operations Team","Active","v1.2","20 May 2025, 02:45 PM"],["Quick Summary Template","Summaries","Summary","Analyst","Active","v1.1","19 May 2025, 11:10 AM"],["Custom Narrative Template","Narratives","Narrative","General","Archived","v1.0","10 May 2025, 05:30 PM"],["Presentation Deck Template","Presentations","Presentation","Leadership","Draft","v0.8","08 May 2025, 03:25 PM"]].map((r,i)=><tr key={i}><td><div className="doc-cell"><IconBox tone={i%2?"purple":"green"}><FileText size={15}/></IconBox><div><b>{r[0]}</b><span>{i===0?"Standard executive summary format":i===1?"Detailed technical brief structure":"Structured template"}</span></div></div></td><td><Badge tone="role">{r[1]}</Badge></td><td>{r[2]}</td><td>{r[3]}</td><td><Badge tone={r[4].toLowerCase()}>{r[4]}</Badge></td><td>{r[5]}</td><td>{r[6]}</td><td><MoreVertical size={16}/></td></tr>)}</tbody></Table><div className="table-foot"><span>Showing 1 to 8 of 48 templates</span><Pager/></div></Card><Card className="template-preview"><h3>Template Preview</h3><Badge tone="green">Active</Badge> <Badge tone="blue">v2.1</Badge><h3>Executive Summary Template</h3><p>Standard executive summary format</p>{[["Category","Reports"],["Output Type","Executive Summary"],["Target Audience","Leadership"],["Description","A structured template for executive summaries with key highlights, context, analysis and recommendations."]].map(([l,v])=><div className="preview-field" key={l}><span>{l}</span><b>{v}</b></div>)}<div className="tags"><span>summary</span><span>executive</span><span>standard</span><span>leadership</span></div><div className="preview-updated"><CalendarDays size={14}/>24 May 2025, 11:30 AM<br/><span>by Administrator</span></div><div className="form-actions"><Button variant="secondary"><Eye size={14}/>Preview Template</Button><Button><Edit3 size={14}/>Edit Template</Button></div></Card></div><div className="notice"><Info size={18}/><span>Templates ensure consistency and quality across all transformations.</span></div></>}

function Transformations(){const[r,setR]=useState([]);useEffect(() => {
  let alive = true;

  const loadTransformations = async () => {
    try {
      const data = await api.transformations();
      if (alive) setR(data);
    } catch (e) {
      // Keep mock data
    }
  };

  loadTransformations();

  return () => {
    alive = false;
  };
}, []);
const rows=r.length?r:recentMock.map((x,i)=>({id:i+1,output_type:x.output,status:x.status,created_at:new Date().toISOString()}));return <><PageTitle title="Transformations" sub="Create, configure, validate and review AI-generated outputs." actions={<NavLink className="btn primary" to="/transformations/new"><Plus size={16}/>New Transformation</NavLink>}/><Card><Toolbar searchText="Search transformations..."><Button variant="select">All Status <ChevronDown size={13}/></Button><Button variant="select">All Output Types <ChevronDown size={13}/></Button></Toolbar><Table><thead><tr><th>ID</th><th>Output Type</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>#{x.id}</td><td>{x.output_type}</td><td><Badge>{x.status}</Badge></td><td>{new Date(x.created_at).toLocaleString()}</td><td><NavLink to={`/transformations/${x.id}`} className="blue-link"><Eye size={15}/>View</NavLink></td></tr>)}</tbody></Table></Card></>}

function GenericList({title,sub,load,cols}){const[r,setR]=useState([]);useEffect(() => {
  let alive = true;

  load()
    .then(data => {
      if (alive) setR(data);
    })
    .catch(() => {});

  return () => {
    alive = false;
  };
}, []);return <><PageTitle title={title} sub={sub}/><Card><Table><thead><tr>{cols.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{r.map((x,i)=><tr key={x.id||i}>{cols.map(c=><td key={c}>{x[c.toLowerCase().replaceAll(" ","_")]??"—"}</td>)}</tr>)}</tbody></Table></Card></>}
function ProfilePage({user}){
  const navigate=useNavigate();

  const logout=()=>{
    localStorage.removeItem("agis_access");
    localStorage.removeItem("agis_draft");
    sessionStorage.clear();
    navigate("/");
    window.location.reload();
  };

  return (
    <>
      <PageTitle
        title="My Profile"
        sub="View your account information and manage your security settings."
      />

      <div className="content-grid">

        <Card>
          <div className="profile-page-head">
            <div className="avatar profile-avatar-large">
              <UserRound size={30}/>
            </div>

            <div>
              <h2>{user?.name||"User"}</h2>
              <p>{user?.role||"Operator"}</p>
              <Badge tone="green">Active</Badge>
            </div>
          </div>

          <div className="profile-fields">

            <div>
              <span>Full Name</span>
              <b>{user?.name||"—"}</b>
            </div>

            <div>
              <span>Username</span>
              <b>{user?.username||"—"}</b>
            </div>

            <div>
              <span>Email</span>
              <b>{user?.email||"—"}</b>
            </div>

            <div>
              <span>Mobile</span>
              <b>{user?.mobile||"—"}</b>
            </div>

            <div>
              <span>Role</span>
              <b>{user?.role||"—"}</b>
            </div>

            <div>
              <span>Account Status</span>
              <Badge tone="green">Active</Badge>
            </div>

          </div>
        </Card>

        <div className="side-stack">

          <Card>
            <h3>Security</h3>

            <div className="summary-row">
              <KeyRound size={16}/>
              <div>
                <span>Password</span>
                <b>Last updated securely</b>
              </div>
            </div>

            <div className="summary-row">
              <ShieldCheck size={16}/>
              <div>
                <span>Multi-Factor Authentication</span>
                <b>Protected</b>
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={()=>navigate("/profile/change-password")}
            >
              <KeyRound size={15}/>
              Change Password
            </Button>
          </Card>

          <Card>
            <h3>Session</h3>
            <p className="section-sub">
              Sign out of your current AGIS session.
            </p>

            <Button
              variant="outline"
              onClick={logout}
            >
              <LogOut size={15}/>
              Logout
            </Button>
          </Card>

        </div>

      </div>
    </>
  );
}

function ApprovalVerification(){
  const params=new URLSearchParams(window.location.search);
  const initialChallenge=params.get("challenge")||"";

  const [challengeId,setChallengeId]=useState(initialChallenge);
  const [code,setCode]=useState(["","","","","",""]);
  const [err,setErr]=useState("");
  const [success,setSuccess]=useState(false);
  const [busy,setBusy]=useState(false);

  const submit=async e=>{
    e.preventDefault();
    setErr("");

    if(!challengeId){
      setErr("Approval challenge ID is required.");
      return;
    }

    const otp=code.join("");

    if(otp.length!==6){
      setErr("Please enter the 6-digit approval OTP.");
      return;
    }

    setBusy(true);

    try{
      await api.verifyApprovalOTP(challengeId,otp);
      setSuccess(true);
    }catch(x){
      setErr(x.message||"Approval verification failed");
    }finally{
      setBusy(false);
    }
  };

  return (
    <div className="login-page">

      <div className="login-hero">
        <div className="hero-inner">

          <div className="hero-brand">
            <strong>AGIS</strong>
            <span>Adaptive GenAI Intelligence System</span>
          </div>

          <div className="hero-sub">
            Secure Account Approval
          </div>

          <div className="hero-line"/>

          <div className="shield-visual">
            <ShieldCheck size={112}/>
            <LockKeyhole className="lock" size={58}/>
          </div>

        </div>
      </div>

      <div className="login-panel">

        <form className="login-card" onSubmit={submit}>

          <div className="login-icon">
            <ShieldCheck size={30}/>
          </div>

          <h1>
            {success ? "Account approved" : "Verify account approval"}
          </h1>

          {success ? (
            <>
              <p>
                Your Reviewer account has been approved and activated by an Administrator.
              </p>

              <div className="success-banner mini">
                <CheckCircle2 size={16}/>
                <span>You can now sign in to AGIS using your Reviewer account.</span>
              </div>

              <Button
                type="button"
                className="login-btn"
                onClick={()=>window.location.href="/"}
              >
                <LogIn size={17}/>
                Go to Login
              </Button>
            </>
          ) : (
            <>
              <p>
                Enter the approval OTP sent to your registered email.
              </p>

              {!initialChallenge && (
                <label>
                  Challenge ID
                  <div className="input-wrap">
                    <KeyRound size={17}/>
                    <input
                      value={challengeId}
                      onChange={e=>setChallengeId(e.target.value)}
                      placeholder="Enter challenge ID"
                    />
                  </div>
                </label>
              )}

              <div className="otp-block">

                <b>Enter Approval OTP</b>

                <div className="otp-row">
                  {code.map((v,i)=>(
                    <input
                      key={i}
                      maxLength="1"
                      autoFocus={i===0}
                      value={v}
                      onChange={e=>{
                        const a=[...code];
                        a[i]=e.target.value.replace(/\D/g,"");
                        setCode(a);

                        if(a[i] && i<5){
                          e.target.nextElementSibling?.focus();
                        }
                      }}
                    />
                  ))}
                </div>

                <div className="otp-meta">
                  <span>
                    OTP sent to your registered email
                  </span>
                </div>

              </div>

              {err && (
                <div className="error">
                  {err}
                </div>
              )}

              <Button className="login-btn" disabled={busy}>
                <ShieldCheck size={17}/>
                {busy ? "Verifying..." : "Verify Approval"}
              </Button>
            </>
          )}

        </form>

      </div>

    </div>
  );
}

function RoleGate({user,roles,children}){if(!roles.includes(user?.role))return <Card><h2>Access Restricted</h2><p className="section-sub">Your role does not have permission to view this module.</p></Card>;return children}
function App(){const visual=new URLSearchParams(window.location.search).has("visual");if(window.location.pathname==="/__visual/login")
  return <Login done={()=>{}} showRegister={()=>{}}/>;if(window.location.pathname==="/approval")
  return <ApprovalVerification/>;const[user,setUser]=useState(visual?VISUAL_TEST_USER:null),[showRegister,setShowRegister]=useState(false);useEffect(() => {
  let alive = true;

  if (!visual && localStorage.agis_access) {
    api.me()
      .then(data => {
        if (alive) setUser(data);
      })
      .catch(() => {
        if (alive) {
          localStorage.removeItem("agis_access");
          setUser(null);
        }
      });
  }

  return () => {
    alive = false;
  };
}, [visual]);if(!user)return showRegister
  ? <Register back={()=>setShowRegister(false)}/>
  : <Login done={setUser} showRegister={()=>setShowRegister(true)}/>;return <Shell user={user}><Routes><Route path="/" element={<Dashboard user={user}/>}/><Route path="/dashboard" element={<Dashboard user={user}/>}/><Route path="/documents" element={<Documents/>}/><Route path="/profile" element={<ProfilePage user={user}/>}/><Route path="/transformations" element={<Transformations/>}/><Route path="/transformations/new" element={<NewTransformation/>}/><Route path="/transformations/config" element={<Configuration/>}/><Route path="/transformations/:id" element={<Output/>}/><Route path="/transformations/:id/review" element={<RoleGate user={user} roles={["Reviewer","Approver","Administrator"]}><Review/></RoleGate>}/><Route path="/audit-logs" element={<AuditLogs/>}/><Route path="/users" element={<RoleGate user={user} roles={["Administrator"]}><UsersPage/></RoleGate>}/><Route path="/roles" element={<RoleGate user={user} roles={["Administrator"]}><RolesPage/></RoleGate>}/><Route path="/system" element={<RoleGate user={user} roles={["Administrator"]}><SystemPage/></RoleGate>}/><Route path="/templates" element={<RoleGate user={user} roles={["Administrator"]}><TemplatesPage/></RoleGate>}/><Route path="*" element={<Dashboard/>}/></Routes></Shell>}
createRoot(document.getElementById("root")).render(<BrowserRouter><App/></BrowserRouter>);



