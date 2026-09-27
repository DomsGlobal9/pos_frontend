"""
make-barcode-video -- a fake camera feed showing a real EAN-13 barcode. For verify-phase10-ui.

    python scripts/make-barcode-video.py 8901234500033 out.y4m

Chrome can use a .y4m file as its camera (--use-file-for-fake-video-capture). Drawing an actual
EAN-13 -- guard bars, left/right code sets, parity from the first digit -- lets the camera scan be
tested end to end in a headless browser: the same decoder, the same search, the same basket.
"""
import sys
from PIL import Image, ImageDraw

L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']


def check_digit(d12):
    s = sum(int(c) * (3 if i % 2 else 1) for i, c in enumerate(d12))
    return str((10 - s % 10) % 10)


def ean13_bits(code):
    if len(code) == 12:
        code += check_digit(code)
    assert len(code) == 13 and code[-1] == check_digit(code[:12]), 'bad EAN-13 check digit'
    first, left, right = int(code[0]), code[1:7], code[7:]
    bits = '101'
    for d, p in zip(left, PARITY[first]):
        bits += (L if p == 'L' else G)[int(d)]
    bits += '01010'
    for d in right:
        bits += R[int(d)]
    bits += '101'
    return bits


def main():
    code, out = sys.argv[1], sys.argv[2]
    W, H, module = 640, 480, 4
    bits = ean13_bits(code)
    img = Image.new('L', (W, H), 255)
    draw = ImageDraw.Draw(img)
    x0 = (W - len(bits) * module) // 2
    for i, b in enumerate(bits):
        if b == '1':
            draw.rectangle([x0 + i * module, 140, x0 + (i + 1) * module - 1, 340], fill=0)
    y = img.tobytes()
    u = bytes([128]) * (W // 2 * H // 2)
    with open(out, 'wb') as f:
        f.write(f'YUV4MPEG2 W{W} H{H} F10:1 Ip A1:1 C420jpeg\n'.encode())
        for _ in range(20):
            f.write(b'FRAME\n' + y + u + u)
    print(out)


main()
