package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io/ioutil"
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

const NearPointer = 0xa7
const FarPointer = 0xa8

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

func main() {
	c3d, err := ioutil.ReadFile("GAMEMAPS.C3D")
	if err != nil {
		panic(err)
	}
	maps, err := MapHeaders(c3d)
	if err != nil {
		panic(err)
	}
	for _, m := range maps {
		fmt.Println(m.Name())
		for i := 0; i < 3; i += 2 {
			fmt.Println("Plane", i)
			start := int(m.PlaneStart[i])
			end := start + int(m.PlaneLength[i])
			planeData := c3d[start:end]
			expandedSize := int(binary.LittleEndian.Uint16(planeData))
			fmt.Println("Carmack compression ratio:", float64(len(planeData))/float64(expandedSize))
			fmt.Println("RLEW compression ratio:", float64(expandedSize)/float64(m.Len()))
			fmt.Println("Aggregate compression raio:", float64(len(planeData))/float64(m.Len()))
			expandedData := make([]byte, expandedSize)
			err := CarmackExpand(expandedData, planeData[2:])
			if err != nil {
				fmt.Println(err)
			}
		}
		fmt.Println()
	}
}
