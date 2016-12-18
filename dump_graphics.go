package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
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
		r.mask = 0x80
	}
	bit := (r.byte & r.mask) != 0
	r.mask = r.mask >> 1
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

func main() {
	g, err := OpenGraphics("EGAGRAPH.C3D", "EGAHEAD.C3D", "EGADICT.C3D")
	if err != nil {
		fmt.Println(err)
	}
	for i := 0; i <= 162; i++ {
		chunk, err := g.Chunk(i)
		if err != nil {
			fmt.Println("chunk", i, err)
			fmt.Println("header", g.header[i])
		}
		if chunk == nil {
			continue
		}
		fmt.Println("chunk", i, len(chunk))
	}
}
