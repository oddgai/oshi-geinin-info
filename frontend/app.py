import os

import httpx
import streamlit as st

BACKEND_HOST = os.environ.get("BACKEND_HOST", "backend:8000")

st.title("好きな芸人登録アプリ")
st.write("好きな芸人を登録・削除して、ライブ情報をLINEで通知を受け取ろう！")

if st.button("押してね"):
    message = httpx.get(f"http://{BACKEND_HOST}/hello")
    st.write(message.json())
