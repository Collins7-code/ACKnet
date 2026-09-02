import streamlit as st
import os

st.set_page_config(page_title="ACKnet | Academy of Christ the King", layout="wide", page_icon="📘")

# ---------- Clean professional theme ----------
st.markdown("""<style>
 html,body,[data-testid=stAppViewContainer]{background:#ffffff;}
 [data-testid=stSidebar]{background:#0B3D91;}
 [data-testid=stSidebar] *{color:#ffffff!important;}
 h1,h2,h3{color:#0B3D91!important;}
 .stButton>button{background:#0B3D91;color:#fff;border-radius:8px;}
</style>""",unsafe_allow_html=True)

# ---------- To activate REAL one-tap Google login later: ----------
# 1) Google Cloud Console -> OAuth consent (External, add your Gmail as test user)
# 2) Credentials -> OAuth client ID (Web) -> redirect URI:
#    https://YOUR-APP.streamlit.app/oauth2callback
# 3) Streamlit Settings -> Secrets -> [auth] + [auth.google] client_id/secret
# 4) Replace the sign-in form below with: st.login("google"); user=st.user.email

SCHOOL="Academy of Christ the King"; TOWN="Cape Coast"
MOTTO="Service to the Church and State"

COURSES=[
 {"name":"General Science","lessons":[
   {"t":"Photosynthesis 101","b":"Plants convert sunlight, water and CO2 into glucose and oxygen. Chlorophyll captures light energy in the chloroplast."},
   {"t":"Newton's Laws of Motion","b":"1) Inertia. 2) Force equals mass times acceleration. 3) Every action has an equal and opposite reaction."}]},
 {"name":"Business","lessons":[
   {"t":"The Marketing Mix (4 Ps)","b":"Product, Price, Place and Promotion - the core decisions of any business."},
   {"t":"Sole Trader vs Company","b":"A sole trader is one owner with unlimited liability; a company is a separate legal entity."}]},
 {"name":"General Arts","lessons":[
   {"t":"Essay Structure","b":"Introduction with a thesis, body paragraphs using PEEL, and a conclusion."},
   {"t":"Literary Devices","b":"Metaphor, simile, personification and irony."}]},
]
QUIZ=[
 {"q":"What is the capital of Ghana?","o":["Kumasi","Accra","Tamale","Cape Coast"],"a":1},
 {"q":"Solve for x: 3x = 15","o":["3","4","5","6"],"a":2},
 {"q":"Which gas do plants absorb?","o":["Oxygen","Nitrogen","Carbon dioxide","Hydrogen"],"a":2},
]
DISCUSSIONS=[
 {"n":"Ama","r":"SHS 2 - General Science","p":"Can someone explain photosynthesis in simple terms?"},
 {"n":"Mr. Owusu","r":"Teacher","p":"Physics past questions 2025 are now in Resources. Good luck."},
 {"n":"SRC","r":"Announcement","p":"Anniversary durbar holds Friday at the assembly hall."},
]
RESOURCES=[
 {"t":"Algebra Worksheet 2","by":"Ms. Mensah"},
 {"t":"Physics Past Questions 2025","by":"Mr. Owusu"},
 {"t":"Essay Marking Scheme","by":"Mrs. Aidoo"},
]

for k,v in {"xp":0,"done":set()}.items():
    if k not in st.session_state: st.session_state[k]=v

def level(xp): return "King's Champion" if xp>=200 else "Scholar" if xp>=100 else "Learner" if xp>=50 else "Newcomer"

# ================= SIGN IN =================
if "user" not in st.session_state:
    c,_,_ = st.columns([1,2,1])
    with c:
        if os.path.exists("badge.png"): st.image("badge.png")
    st.title("ACKnet")
    st.caption(f"{SCHOOL} · {TOWN} · {MOTTO}")
    with st.form("login"):
        st.write("Sign in with your school Gmail")
        name=st.text_input("Full name")
        email=st.text_input("Gmail address")
        role=st.selectbox("I am a",["Student","Teacher"])
        if st.form_submit_button("Sign in"):
            if name and email.strip().lower().endswith("@gmail.com"):
                st.session_state["user"]={"name":name,"email":email,"role":role}
                st.rerun()
            else:
                st.error("Enter your name and a valid Gmail address.")
    st.stop()

user=st.session_state["user"]

# ================= HEADER =================
h1,h2,h3,h4 = st.columns([1,3,2,1])
if os.path.exists("badge.png"): h1.image("badge.png", width=56)
h2.title("ACKnet")
h3.caption(f"{user['name']} · {user['role']}")
if h4.button("Sign out"):
    st.session_state.clear(); st.rerun()

page=st.sidebar.radio("Menu",["Dashboard","My Courses","Discussions","Resources","Live Sessions"])

# ================= DASHBOARD =================
if page=="Dashboard":
    st.header(f"Welcome, {user['name'].split()[0]}")
    m1,m2,m3=st.columns(3)
    m1.metric("Points",st.session_state.xp)
    m2.metric("Level",level(st.session_state.xp))
    m3.metric("Lessons completed",len(st.session_state.done))
    st.subheader("Your courses")
    for course in COURSES:
        total=len(course["lessons"])
        done=sum(1 for l in course["lessons"] if f"{course['name']}|{l['t']}" in st.session_state.done)
        st.write(course["name"])
        st.progress(done/total)
        st.caption(f"{done} of {total} lessons completed")

# ================= COURSES =================
if page=="My Courses":
    st.header("My Courses")
    choice=st.selectbox("Course",[c["name"] for c in COURSES])
    course=next(c for c in COURSES if c["name"]==choice)
    lt=st.selectbox("Lesson",[l["t"] for l in course["lessons"]])
    lesson=next(l for l in course["lessons"] if l["t"]==lt)
    st.info(lesson["b"])
    key=f"{choice}|{lt}"
    if st.button("Mark lesson complete (+10 points)"):
        if key not in st.session_state.done:
            st.session_state.done.add(key); st.session_state.xp+=10; st.rerun()
    if key in st.session_state.done: st.success("Completed")
    st.subheader("Quiz")
    answers={}
    with st.form("quiz"):
        for i,q in enumerate(QUIZ): answers[i]=st.radio(q["q"],q["o"],key=f"q{i}")
        if st.form_submit_button("Submit quiz"):
            s=sum(1 for i,q in enumerate(QUIZ) if answers[i]==q["o"][q["a"]])
            st.session_state.xp+=s*10
            st.success(f"Score: {s}/{len(QUIZ)}  (+{s*10} points)")

# ================= DISCUSSIONS =================
if page=="Discussions":
    st.header("Discussions")
    for d in DISCUSSIONS:
        st.write(f"{d['n']}  ·  {d['r']}")
        st.caption(d["p"])
        st.divider()
    with st.form("post"):
        p=st.text_area("Start a discussion")
        if st.form_submit_button("Post") and p:
            DISCUSSIONS.insert(0,{"n":user["name"],"r":user["role"],"p":p})
            st.success("Posted")

# ================= RESOURCES =================
if page=="Resources":
    st.header("Resources")
    for r in RESOURCES:
        st.write(r["t"]); st.caption(f"Shared by {r['by']}"); st.divider()
    if user["role"]=="Teacher":
        with st.form("res"):
            t=st.text_input("Resource title")
            if st.form_submit_button("Share resource") and t:
                RESOURCES.insert(0,{"t":t,"by":user["name"]}); st.success("Shared")

# ================= LIVE =================
if page=="Live Sessions":
    st.header("Live Sessions")
    st.write("Teachers start a live class here. Students join with one tap.")
    st.link_button("Join live class","https://meet.google.com")

st.caption("ACKnet · Academy of Christ the King · built by Collins Nyankson")
