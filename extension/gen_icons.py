"""
Generates simple PNG icons for the Theme Force extension.
Uses only Python stdlib — no Pillow required.
"""
import struct, zlib, os

def make_png(size, bg, fg):
    """Create a minimal valid PNG of `size`x`size` pixels.

    Draws a filled circle (the yin-yang / half-circle icon stand-in) on bg.
    bg / fg are (R, G, B) tuples.
    """
    pixels = []
    cx = cy = size / 2
    r = size / 2 - 1

    for y in range(size):
        row = []
        for x in range(size):
            dx = x - cx
            dy = y - cy
            dist = (dx*dx + dy*dy) ** 0.5
            if dist > r:
                row.extend([0, 0, 0, 0])          # transparent outside circle
            elif x < cx:
                row.extend([*fg, 255])             # left half = fg
            else:
                row.extend([*bg, 255])             # right half = bg
        pixels.append(bytes(row))

    def chunk(name, data):
        c = name + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    ihdr = chunk(b'IHDR', ihdr_data)

    # IDAT (filter byte 0 = None prepended to each row)
    raw = b''.join(b'\x00' + row for row in pixels)
    idat = chunk(b'IDAT', zlib.compress(raw))

    iend = chunk(b'IEND', b'')

    return b'\x89PNG\r\n\x1a\n' + ihdr + idat + iend


BG = (30, 30, 46)    # dark navy
FG = (137, 180, 250) # blue accent

for size in (16, 32, 48, 128):
    path = os.path.join(os.path.dirname(__file__), 'icons', f'icon{size}.png')
    with open(path, 'wb') as f:
        f.write(make_png(size, BG, FG))
    print(f'wrote {path}')
