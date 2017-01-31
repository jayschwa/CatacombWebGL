package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"io/ioutil"
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

type HeaderOffset uint32

func (b HeaderOffset) Valid() bool {
	return true
}

func (b HeaderOffset) Value() int {
	return int(b)
}

type Header [92]HeaderOffset

func (h Header) ChunkLen(i int) int {
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

type Asset struct {
	data      []byte
	header    Header
	hufftable HuffTable

	cache map[int][]byte
}

func OpenAsset(data, header, dictionary string) (*Asset, error) {
	var a Asset
	read := func(to interface{}, from_file string) error {
		f, err := os.Open(from_file)
		if err != nil {
			return err
		}
		defer f.Close()
		return binary.Read(f, binary.LittleEndian, to)
	}
	err := read(&a.header, header)
	if err != nil {
		return nil, err
	}
	err = read(&a.hufftable, dictionary)
	if err != nil {
		return nil, err
	}
	a.data = make([]byte, a.header[len(a.header)-1].Value()) // last value in header is data size
	err = read(a.data, data)
	if err != nil {
		return nil, err
	}
	a.cache = make(map[int][]byte)
	return &a, nil
}

func (a *Asset) Chunk(i int) ([]byte, error) {
	if data, ok := a.cache[i]; ok {
		return data, nil
	}
	if !a.header[i].Valid() {
		return nil, nil
	}

	// c_ denotes compressed, d_ denotes decompressed
	offset := a.header[i].Value()
	c_size := a.header.ChunkLen(i)
	fmt.Println(offset, c_size)
	d_size := binary.LittleEndian.Uint32(a.data[offset : offset+4])

	c_data := a.data[offset+4 : offset+c_size]
	d_data := make([]byte, d_size)
	err := a.hufftable.Expand(d_data, c_data)
	if err != nil {
		return nil, err
	}
	a.cache[i] = d_data
	return d_data, nil
}

func main() {
	asset, err := OpenAsset("AUDIO.C3D", "AUDIOHEAD.C3D", "AUDIODICT.C3D")
	if err != nil {
		panic(err)
	}
	for i, a := range asset.header {
		fmt.Println(i, a.Valid(), a.Value(), asset.header.ChunkLen(i))
	}
	for i := 30; i < 60; i++ {
		data, err := asset.Chunk(i)
		fmt.Println("chunk", i)
		if err != nil {
			fmt.Println(err)
			continue
		}
		err = ioutil.WriteFile(fmt.Sprintf("audio/%v.imf", i), data, 0666)
		if err != nil {
			panic(err)
		}
	}
}
