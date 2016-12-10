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
		fmt.Println(m)
	}
}
