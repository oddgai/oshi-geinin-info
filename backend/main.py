from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello from FastAPI backend"}


@app.get("/hello")
async def hello():
    return {"message": "ボタンが押されたよ！"}
