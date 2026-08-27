"""
Application entry point.

Stateless FastAPI backend with app creation delegated to the factory module.
"""
from app_factory import create_app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8060, reload=True)
