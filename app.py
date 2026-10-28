"""Servidor Flask que entrega el sitio estático del dashboard."""

from flask import Flask, send_from_directory

app = Flask(__name__, static_folder="public", static_url_path="")


@app.get("/")
def inicio():
    """Muestra la versión compilada del dashboard."""
    return send_from_directory("public", "index.html")
