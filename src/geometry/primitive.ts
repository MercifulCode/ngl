/**
 * @file Primitive
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */

import { Vector3, Color, Box3 } from 'three'

import { BufferRegistry, PickerRegistry } from '../globals'
import Shape from './shape'
import { getFixedLengthDashData } from './dash'

function addElement (elm: any, array: any[]) {
  if (elm.toArray !== undefined) {
    elm = elm.toArray()
  } else if (elm.x !== undefined) {
    elm = [ elm.x, elm.y, elm.z ]
  } else if (elm.r !== undefined) {
    elm = [ elm.r, elm.g, elm.b ]
  }
  array.push.apply(array, elm)
}

const tmpVec = new Vector3()

export type PrimitiveFields = { [k: string]: string }

/**
 * Base class for geometry primitives
 * @interface
 */
export class Primitive {
  public type: string;
  public fields: PrimitiveFields = {}

  public get Picker () { return PickerRegistry.get(this.type) }
  public get Buffer () { return BufferRegistry.get(this.type) }

  public getShapeKey (name: string) {
    return this.type + name[0].toUpperCase() + name.substr(1)
  }

  public expandBoundingBox (box: Box3, data: any) {}

  public valueToShape (shape: Shape, name: string, value: any) {
    const data = shape._primitiveData[this.getShapeKey(name)]
    const type = this.fields[name]

    switch (type) {
      case 'v3':
      case 'c':
        addElement(value, data)
        break
      default:
        data.push(value)
    }
  }

  public objectToShape (shape: Shape, data: any) {
    Object.keys(this.fields).forEach(name => {
      this.valueToShape(shape, name, data[name])
    })
    this.valueToShape(shape, 'name', data.name)
    this.expandBoundingBox(shape.boundingBox, data)
  }

  public valueFromShape (shape: Shape, pid: number, name: string) {
    const data = shape._primitiveData[this.getShapeKey(name)]
    const type = this.fields[name]

    switch (type) {
      case 'v3':
        return new Vector3().fromArray(data, 3 * pid)
      case 'c':
        return new Color().fromArray(data, 3 * pid)
      default:
        return data[pid]
    }
  }

  public objectFromShape (shape: Shape, pid: number) {
    let name = this.valueFromShape(shape, pid, 'name')
    if (name === undefined) {
      name = `${this.type}: ${pid} (${shape.name})`
    }
    const o: any = { shape, name }

    Object.keys(this.fields).forEach(name => {
      o[name] = this.valueFromShape(shape, pid, name)
    })

    return o
  }

  public arrayFromShape (shape: Shape, name: string) {
    const data = shape._primitiveData[this.getShapeKey(name)]
    const type = this.fields[name]

    switch (type) {
      case 's':
        return data
      default:
        return new Float32Array(data)
    }
  }

  public dataFromShape (shape: Shape) {
    const data: any = {}

    if (this.Picker) {
      data.picking = new this.Picker(shape)
    }

    Object.keys(this.fields).forEach(name => {
      data[name] = this.arrayFromShape(shape, name)
    })

    return data
  }

  public bufferFromShape (shape: Shape, params: any) {
    return new this.Buffer(this.dataFromShape(shape), params)
  }

  public positionFromShape (shape: Shape, pid: number) {
    return this.valueFromShape(shape, pid, 'position')
  }
}

/**
 * Sphere geometry primitive
 */
export class SpherePrimitive extends Primitive {
  public type = 'sphere'

  public fields = {
    position: 'v3',
    color: 'c',
    radius: 'f'
  }

  public positionFromShape (shape: Shape, pid: number) {
    return this.valueFromShape(shape, pid, 'position')
  }

  public expandBoundingBox (box: Box3, data: any) {
    box.expandByPoint(tmpVec.fromArray(data.position))
  }
}

/**
 * Box geometry primitive
 */
export class BoxPrimitive extends Primitive {
  public type = 'box'

  public fields = {
    position: 'v3',
    color: 'c',
    size: 'f',
    heightAxis: 'v3',
    depthAxis: 'v3'
  }

  public positionFromShape (shape: Shape, pid: number) {
    return this.valueFromShape(shape, pid, 'position')
  }

  public expandBoundingBox (box: Box3, data: any) {
    box.expandByPoint(tmpVec.fromArray(data.position))
  }
}

/**
 * Octahedron geometry primitive
 */
export class OctahedronPrimitive extends BoxPrimitive {
  public type = 'octahedron'
}

/**
 * Tetrahedron geometry primitive
 */
export class TetrahedronPrimitive extends BoxPrimitive {
  public type = 'tetrahedron'
}

/**
 * Cylinder geometry primitive
 */
export class CylinderPrimitive extends Primitive {
  public type = 'cylinder'

  public fields = {
    position1: 'v3',
    position2: 'v3',
    color: 'c',
    radius: 'f'
  }

  public positionFromShape (shape: Shape, pid: number) {
    const p1 = this.valueFromShape(shape, pid, 'position1')
    const p2 = this.valueFromShape(shape, pid, 'position2')
    return p1.add(p2).multiplyScalar(0.5)
  }

  public expandBoundingBox (box: Box3, data: any) {
    box.expandByPoint(tmpVec.fromArray(data.position1))
    box.expandByPoint(tmpVec.fromArray(data.position2))
  }

  public bufferFromShape (shape: Shape, params: any = {}) {
    let data = this.dataFromShape(shape)
    if (this.type === 'cylinder' && params.dashedCylinder) {
      data = getFixedLengthDashData(data)
    }
    return new this.Buffer(data, params)
  }
}

/**
 * Arrow geometry primitive
 */
export class ArrowPrimitive extends CylinderPrimitive {
  public type = 'arrow'
}

/**
 * Cone geometry primitive
 */
export class ConePrimitive extends CylinderPrimitive {
  public type = 'cone'
}

/**
 * Ellipsoid geometry primitive
 */
export class EllipsoidPrimitive extends SpherePrimitive {
  public type = 'ellipsoid'

  public fields = {
    position: 'v3',
    color: 'c',
    radius: 'f',
    majorAxis: 'v3',
    minorAxis: 'v3'
  }
}

/**
 * Torus geometry primitive
 */
export class TorusPrimitive extends EllipsoidPrimitive {
  public type = 'torus'
}

/**
 * Text geometry primitive
 */
export class TextPrimitive extends Primitive {
  public type = 'text'

  public fields = {
    position: 'v3',
    color: 'c',
    size: 'f',
    text: 's'
  }

  public positionFromShape (shape: Shape, pid: number) {
    return this.valueFromShape(shape, pid, 'position')
  }

  public expandBoundingBox (box: Box3, data: any) {
    box.expandByPoint(tmpVec.fromArray(data.position))
  }
}

/**
 * Point primitive
 */
export class PointPrimitive extends Primitive {
  public type = 'point'

  public fields = {
    position: 'v3',
    color: 'c',
  }

  public positionFromShape (shape: Shape, pid: number) {
    return this.valueFromShape(shape, pid, 'position')
  }

  public expandBoundingBox (box: Box3, data: any) {
    box.expandByPoint(tmpVec.fromArray(data.position))
  }
}

/**
 * Wideline geometry primitive
 */
export class WidelinePrimitive extends Primitive {
  public type = 'wideline'

  public fields = {
    position1: 'v3',
    position2: 'v3',
    color: 'c'
  }

  public positionFromShape (shape: Shape, pid: number) {
    const p1 = this.valueFromShape(shape, pid, 'position1')
    const p2 = this.valueFromShape(shape, pid, 'position2')
    return p1.add(p2).multiplyScalar(0.5)
  }

  public expandBoundingBox (box: Box3, data: any) {
    box.expandByPoint(tmpVec.fromArray(data.position1))
    box.expandByPoint(tmpVec.fromArray(data.position2))
  }
}
