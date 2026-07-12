import struct
import zlib
from pathlib import Path


def chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def solid_png(path: Path, w: int, h: int, rgba: tuple[int, int, int, int]) -> None:
    r, g, b, a = rgba
    row = bytes([r, g, b, a]) * w
    raw = b"".join(b"\x00" + row for _ in range(h))
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


assets = Path(__file__).resolve().parent.parent / "assets"
assets.mkdir(parents=True, exist_ok=True)

solid_png(assets / "icon.png", 1024, 1024, (37, 99, 235, 255))
solid_png(assets / "adaptive-icon.png", 1024, 1024, (37, 99, 235, 255))
solid_png(assets / "splash.png", 1284, 2778, (11, 14, 20, 255))
solid_png(assets / "notification-icon.png", 96, 96, (255, 255, 255, 255))
print("assets ok")
