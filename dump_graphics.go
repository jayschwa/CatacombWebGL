package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"os"
)

type BitReader struct {
	io.ByteReader
	byte, mask byte
}

func NewBitReader(b []byte) *BitReader {
	return &BitReader{bytes.NewReader(b), 0, 0}
}

func (r *BitReader) ReadBit() (bool, error) {
	if r.mask == 0 {
		byte, err := r.ReadByte()
		if err != nil {
			return false, err
		}
		r.byte = byte
		r.mask = 0x01
	}
	bit := (r.byte & r.mask) != 0
	r.mask = r.mask << 1
	return bit, nil
}

type HuffNode struct {
	Bit0, Bit1 uint16
}

func (n HuffNode) Value(bit bool) (val byte, leaf bool) {
	side := n.Bit0
	if bit {
		side = n.Bit1
	}
	return byte(side), side < 256
}

type HuffTable [256]HuffNode

func (t *HuffTable) root() HuffNode {
	return t[254]
}

func (t *HuffTable) Expand(dst, src []byte) error {
	r := NewBitReader(src)
	for i := 0; i < len(dst); i++ {
		node := t.root()
		for {
			bit, err := r.ReadBit()
			if err != nil {
				if err == io.EOF {
					err = fmt.Errorf("EOF on decompressed byte %v of %v from %v compressed bytes", i, len(dst), len(src))
				}
				return err
			}
			val, leaf := node.Value(bit)
			if leaf {
				dst[i] = val
				break
			} else {
				node = t[val]
			}
		}
	}
	return nil
}

type GraphicsOffset [3]byte

func (b GraphicsOffset) Valid() bool {
	return b[0] != 0xff || b[1] != 0xff || b[2] != 0xff
}

func (b GraphicsOffset) Value() int {
	var offset int
	offset += int(b[2]) << 16
	offset += int(b[1]) << 8
	offset += int(b[0])
	return offset
}

type GraphicsHeader [479]GraphicsOffset

func (h *GraphicsHeader) ChunkLen(i int) int {
	if !h[i].Valid() {
		return -1
	}
	for k := i + 1; k < len(h); k++ {
		if h[k].Valid() {
			return h[k].Value() - h[i].Value()
		}
	}
	return -1
}

type Graphics struct {
	data      []byte
	header    GraphicsHeader
	hufftable HuffTable

	cache map[int][]byte
}

func OpenGraphics(data, header, dictionary string) (*Graphics, error) {
	var g Graphics
	read := func(to interface{}, from_file string) error {
		f, err := os.Open(from_file)
		if err != nil {
			return err
		}
		defer f.Close()
		return binary.Read(f, binary.LittleEndian, to)
	}
	err := read(&g.header, header)
	if err != nil {
		return nil, err
	}
	err = read(&g.hufftable, dictionary)
	if err != nil {
		return nil, err
	}
	g.data = make([]byte, g.header[len(g.header)-1].Value()) // last value in header is data size
	err = read(g.data, data)
	if err != nil {
		return nil, err
	}
	g.cache = make(map[int][]byte)
	return &g, nil
}

func (g *Graphics) Chunk(i int) ([]byte, error) {
	if data, ok := g.cache[i]; ok {
		return data, nil
	}
	if !g.header[i].Valid() {
		return nil, nil
	}

	// c_ denotes compressed, d_ denotes decompressed
	offset := g.header[i].Value()
	c_size := g.header.ChunkLen(i)
	d_size := binary.LittleEndian.Uint32(g.data[offset : offset+4])

	c_data := g.data[offset+4 : offset+c_size]
	d_data := make([]byte, d_size)
	err := g.hufftable.Expand(d_data, c_data)
	if err != nil {
		return nil, err
	}
	g.cache[i] = d_data
	return d_data, nil
}

type Dimensions struct {
	Width, Height int16
}

func (d Dimensions) String() string {
	return fmt.Sprintf("%vx%v", d.Width, d.Height)
}

type PictureTable []Dimensions

func (g *Graphics) PictureTable() (PictureTable, error) {
	chunk, err := g.Chunk(0)
	if err != nil {
		return nil, err
	}
	table := make(PictureTable, len(chunk)/4)
	err = binary.Read(bytes.NewReader(chunk), binary.LittleEndian, table)
	if err != nil {
		return nil, err
	}
	for i := range table {
		table[i].Width *= 8
	}
	return table, nil
}

func (g *Graphics) Picture(i int) (*Picture, error) {
	picTable, err := g.PictureTable()
	if err != nil {
		return nil, err
	}
	dims := picTable[i-5]
	chunk, err := g.Chunk(i)
	if err != nil {
		return nil, err
	}
	return &Picture{chunk, dims}, nil
}

type Picture struct {
	data []byte
	dims Dimensions
}

var Magenta = color.RGBA{0xAA, 0x00, 0xAA, 0xFF}

func (p *Picture) At(x, y int) color.Color {
	planeSize := int(p.dims.Width*p.dims.Height) / 8
	if len(p.data) / planeSize < 4 {
		return color.Gray{}
	}

	planes := make([][]byte, 4)
	for i := range planes {
		start := i * planeSize
		end := start + planeSize
		planes[i] = p.data[start:end]
	}
	pos := x + y*int(p.dims.Width)
	readBit := func(plane int) bool {
		byte := planes[plane][pos/8]
		shift := uint(7 - pos%8)
		return (byte>>shift)&0x01 != 0
	}
	intense := readBit(3)
	readColor := func(plane int) byte {
		if readBit(plane) {
			if intense {
				return 0xFF
			} else {
				return 0xAA
			}
		} else {
			if intense {
				return 0x55
			} else {
				return 0x00
			}
		}
	}
	c := color.RGBA{
		R: readColor(2),
		G: readColor(1),
		B: readColor(0),
		A: 0xFF,
	}
	if c == Magenta {
		c.A = 0x00
	}
	return c
}

func (p *Picture) Bounds() image.Rectangle {
	return image.Rectangle{
		Max: image.Point{int(p.dims.Width), int(p.dims.Height)},
	}
}

func (p *Picture) ColorModel() color.Model {
	return color.RGBAModel
}

func main() {
	g, err := OpenGraphics("EGAGRAPH.C3D", "EGAHEAD.C3D", "EGADICT.C3D")
	if err != nil {
		panic(err)
	}
	for i := 21; i < 160; i++ {
		pic, err := g.Picture(i)
		fmt.Println("picture", i)
		if err != nil {
			fmt.Println(err)
			continue
		}
		f, err := os.Create(fmt.Sprintf("pictures/%v.png", i))
		if err != nil {
			panic(err)
		}
		png.Encode(f, pic)
		f.Close()
	}
}
