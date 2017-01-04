package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io/ioutil"
	"strings"
)

type MapHeader struct {
	PlaneStart    [3]int32
	PlaneLength   [3]uint16
	Width, Height uint16
	NameBuf       [16]byte
}

func (m *MapHeader) Len() int {
	return int(m.Width) * int(m.Height) * 2
}

// Name returns the name of the map.
func (m *MapHeader) Name() string {
	name := m.NameBuf[:]
	end := bytes.IndexByte(name, 0)
	if end >= 0 {
		name = name[:end]
	}
	return string(name)
}

func MapHeaders(c3d []byte) (headers []*MapHeader, err error) {
	chunks := bytes.Split(c3d, []byte("!ID!"))
	if len(chunks) > 0 {
		chunks = chunks[:len(chunks)-1]
	}
	for _, chunk := range chunks {
		mh := new(MapHeader)
		idx := len(chunk) - binary.Size(mh)
		if idx < 0 {
			break
		}
		err := binary.Read(bytes.NewBuffer(chunk[idx:]), binary.LittleEndian, mh)
		if err != nil {
			return nil, err
		}
		headers = append(headers, mh)
	}
	return headers, nil
}

const NearPointer = 0xA7
const FarPointer = 0xA8

func CarmackExpand(dst, src []byte) error {
	di, si := 0, 0
	for si < len(src) {
		lo, hi := src[si], src[si+1]
		si += 2
		if hi == NearPointer || hi == FarPointer {
			count := int(lo) * 2
			if count > 0 {
				var off int
				if hi == NearPointer {
					off = di - int(src[si])*2
					si += 1
				} else {
					off = int(binary.LittleEndian.Uint16(src[si:])) * 2
					si += 2
				}
				di += copy(dst[di:], dst[off:off+count])
			} else {
				dst[di], dst[di+1] = src[si], hi
				di += 2
				si += 1
			}
		} else {
			dst[di], dst[di+1] = lo, hi
			di += 2
		}
	}
	if di != len(dst) {
		return fmt.Errorf("dst buffer has length of %v but was filled to %v", len(dst), di)
	}
	return nil
}

func RLEWExpand(dst, src []byte) error {
	words := make([]uint16, len(src)/2)
	err := binary.Read(bytes.NewBuffer(src), binary.LittleEndian, words)
	size := int(words[0])
	if len(dst) != size {
		return fmt.Errorf("dst buffer length %v does not match prefixed length %v in compressed data", len(dst), size)
	}
	words = words[1:]
	if err != nil {
		panic(err)
	}
	di, si := 0, 0
	for si < len(words) {
		word := words[si]
		si += 1
		if word == 0xABCD {
			count := int(words[si])
			data := words[si+1]
			si += 2
			for i := 0; i < count; i++ {
				binary.LittleEndian.PutUint16(dst[di:], data)
				di += 2
			}
		} else {
			binary.LittleEndian.PutUint16(dst[di:], word)
			di += 2
		}
	}
	if di != len(dst) {
		return fmt.Errorf("dst buffer has length of %v but was filled to %v", len(dst), di)
	}
	return nil
}

func main() {
	c3d, err := ioutil.ReadFile("GAMEMAPS.C3D")
	if err != nil {
		panic(err)
	}
	maps, err := MapHeaders(c3d)
	if err != nil {
		panic(err)
	}
	for mn, m := range maps {
		fmt.Println(m.Name(), m.Width, "x", m.Height)
		var planes [3][]byte
		for i := 0; i < 3; i += 2 {
			fmt.Println("Plane", i)
			start := int(m.PlaneStart[i])
			end := start + int(m.PlaneLength[i])
			planeData := c3d[start:end]
			expandedSize := int(binary.LittleEndian.Uint16(planeData))
			fmt.Println("Carmack compression ratio:", float64(len(planeData))/float64(expandedSize))
			fmt.Println("RLEW compression ratio:", float64(expandedSize)/float64(m.Len()))
			fmt.Println("Aggregate compression ratio:", float64(len(planeData))/float64(m.Len()))
			expandedData := make([]byte, expandedSize)
			err := CarmackExpand(expandedData, planeData[2:])
			if err != nil {
				fmt.Println(err)
			}
			planeWords := make([]byte, m.Len())
			err = RLEWExpand(planeWords, expandedData)
			if err != nil {
				fmt.Println(err)
			}
			planes[i] = make([]byte, len(planeWords)/2)
			for k := range planes[i] {
				if planeWords[k*2+1] != 0 {
					panic(fmt.Errorf("word %v on plane %v of %v is not zero", k, i, m.Name()))
				}
				planes[i][k] = planeWords[k*2] // condense down to bytes - high byte is never used
			}
		}

		// Dump uncompressed plane 0 to file, prefixed with width and height bytes
		file_bytes := make([]byte, len(planes[0])+2)
		file_bytes[0] = byte(m.Width)
		file_bytes[1] = byte(m.Height)
		copy(file_bytes[2:], planes[0])
		filename := strings.Replace(m.Name(), " ", "_", -1)
		filename = fmt.Sprintf("maps/%v_%v.c3dmap", mn, filename)
		err = ioutil.WriteFile(filename, file_bytes, 0777)
		if err != nil {
			panic(err)
		}

		// Draw text map
		for h := 0; h < int(m.Height); h++ {
			for w := 0; w < int(m.Width); w++ {
				idx := w + h*int(m.Width)
				d := planes[0][idx]
				if d > 0x20 {
					d = 0
				}
				if d == 0 {
					d = planes[2][idx]
				}
				if d == 0 {
					fmt.Print("  ")
				} else {
					fmt.Printf("%02X", d)
				}
			}
			fmt.Println()
		}
		fmt.Println()
	}
}
