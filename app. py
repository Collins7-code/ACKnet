import streamlit as st
import urllib.parse

st.set_page_config(page_title="ACKnet — Academy of Christ the King", page_icon="📘", layout="wide")

# ================= EDIT ACKNET FACTS HERE =================
SCHOOL_NAME = "Academy of Christ the King"
SHORT = "ACKnet"
DEEP_BLUE = "#0B3D91"
WHITE = "#FFFFFF"
WHATSAPP = "233535417063"

COURSES = ["General Science", "Business", "General Arts", "Visual Arts", "Home Economics"]

SAMPLE_QUIZ = [
    {"q":"What is the capital of Ghana?", "opts":["Kumasi","Accra","Tamale","Cape Coast"], "a":1},
    {"q":"Solve: 3x = 15, x = ?", "opts":["3","4","5","6"], "a":2},
    {"q":"Which gas do plants absorb?", "opts":["Oxygen","Nitrogen","Carbon dioxide","Hydrogen"], "a":2},
]
# ==========================================================

# Deep blue & white theme
st.markdown(f"""
<style>
  html,body,[data-testid="stAppViewContainer"]{{background:{WHITE};}}
  h1,h2,h3,h4{{color:{DEEP_BLUE} !important;}}
  .stButton>button{{background:{DEEP_BLUE};color:{WHITE};border-radius:8px;}}
  [data-testid="stSidebar"]{{background:{DEEP_BLUE};}}
  [data-testid="stSidebar"] *{{color:{WHITE} !important;}}
</style>
""", unsafe_allow_html=True)

st.title(f"📘 {SHORT}")
st.caption(f"{SCHOOL_NAME} · The student & teacher network · Built by Collins Nyankson 🇬🇭")

def wa_link(text):
    return f"https://wa.me/{WHATSAPP}?text=" + urllib.parse.quote(text)

space = st.sidebar.radio("Choose your space", COURSES + ["🏫 General Hub", "🧑‍🏫 Teachers' Lounge"])

if space == "🧑‍🏫 Teachers' Lounge":
    st.header("🧑‍ Teachers' Lounge")
    st.caption("A space for staff to interact and exchange documents.")
    st.markdown("**Ms. Mensah** · *Mathematics*")
    st.markdown("> Sharing my SHS 2 algebra worksheet — feel free to adapt it.")
    st.markdown("---")
    with st.form("t_form"):
        tname = st.text_input("Your name")
        tmsg = st.text_area("What are you sharing / discussing?")
        ts = st.form_submit_button("Send via WhatsApp")
    if ts and tname and tmsg:
        st.link_button("📲 Open WhatsApp to send", wa_link(f"🧑‍ TEACHERS' LOUNGE\n{tname}: {tmsg}"))

elif space == "🏫 General Hub":
    st.header("🏫 General Hub")
    st.caption("Whole-school announcements & discussions.")
    st.markdown("**SRC President** · *Announcement*")
    st.markdown("> Anniversary durbar holds Friday at the assembly hall. All students welcome!")
    st.markdown("---")
    with st.form("g_form"):
        gname = st.text_input("Your name")
        gmsg = st.text_area("Your post")
        gs = st.form_submit_button("Send via WhatsApp")
    if gs and gname and gmsg:
        st.link_button("📲 Open WhatsApp to send", wa_link(f"🏫 GENERAL HUB\n{gname}: {gmsg}"))

else:
    st.header(f"🎓 {space} Hub")
    tab_d, tab_n, tab_q, tab_l = st.tabs(["💬 Discussion", "📚 Notes", "📝 Quiz", "🔴 Live"])
    with tab_d:
        st.markdown("**Ama** · *Student*")
        st.markdown("> Can someone explain photosynthesis in simple terms?")
        st.markdown("---")
        with st.form("d_form"):
            dname = st.text_input("Your name")
            dmsg = st.text_area("Your question / comment")
            ds = st.form_submit_button("Send via WhatsApp")
        if ds and dname and dmsg:
            st.link_button("📲 Open WhatsApp to send", wa_link(f"💬 {space} HUB\n{dname}: {dmsg}"))
    with tab_n:
        st.markdown("📄 **Algebra Worksheet 2** — shared by Mr. Owusu")
        st.markdown("🔗 **Physics past questions 2025**")
        st.markdown("---")
        with st.form("n_form"):
            nname = st.text_input("Your name")
            nmsg = st.text_area("What resource are you sharing?")
            ns = st.form_submit_button("Send via WhatsApp")
        if ns and nname and nmsg:
            st.link_button("📲 Open WhatsApp to send", wa_link(f"📚 {space} NOTES\n{nname}: {nmsg}"))
    with tab_q:
        st.subheader("📝 This week's quiz")
        answers = {}
        with st.form("quiz"):
            for i, item in enumerate(SAMPLE_QUIZ):
                answers[i] = st.radio(item["q"], item["opts"], key=f"q{i}")
            qs = st.form_submit_button("Submit quiz")
        if qs:
            score = sum(1 for i, item in enumerate(SAMPLE_QUIZ) if answers[i] == item["opts"][item["a"]])
            st.success(f"You scored {score}/{len(SAMPLE_QUIZ)} 🎉")
    with tab_l:
        st.info("Live classes open here. For now, your teacher shares the Meet link in Discussion.")
        st.link_button("🔴 Join live class (sample)", "https://meet.google.com")

st.markdown("---")
st.caption(f"{SHORT} v1 · a working prototype for the one-class pilot. Accounts, saved posts & real-time video arrive in v2. Built with ❤️ by Collins.")
