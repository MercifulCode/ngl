import { Mesh } from 'three';
/**
 * @file Picker
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */

import { Vector3 } from 'three'

import { PickerRegistry } from '../globals'
import { calculateMeanVector3 } from '../math/vector-utils'
import Selection from '../selection/selection'
import {
  ArrowPrimitive, BoxPrimitive, ConePrimitive, CylinderPrimitive,
  EllipsoidPrimitive, OctahedronPrimitive, SpherePrimitive,
  TetrahedronPrimitive, TorusPrimitive, PointPrimitive, WidelinePrimitive, Primitive
} from '../geometry/primitive'
import { contactTypeName } from '../chemistry/interactions/contact'
import { TypedArray } from '../types';
import Component from '../component/component';
import { Shape, Structure } from '../ngl';
import BondStore from '../store/bond-store';
import PrincipalAxes from '../math/principal-axes';
import Unitcell from '../symmetry/unitcell';
import { AtomProxy } from '../proxy/atom-proxy';
import BondProxy from '../proxy/bond-proxy';

/**
 * Picker class
 * @interface
 */
class Picker {
  /**
   * @param  {Array|TypedArray} [array] - mapping
   */
  constructor (readonly array: Array<any> | TypedArray) {
  }

  get type () { return '' }
  get data () { return {} }

  /**
   * Get the index for the given picking id
   * @param  {number} pid - the picking id
   * @return {number} the index
   */
  getIndex (pid: number) {
    return this.array ? this.array[ pid ] : pid
  }

  /**
   * Get object data
   * @abstract
   * @param  {number} pid - the picking id
   * @return {Object} the object data
   */
  getObject (pid: number) {
    return {}
  }

  _applyTransformations (vector: Vector3, instance: any, component: Component) {
    if (instance) {
      vector.applyMatrix4(instance.matrix)
    }
    if (component) {
      vector.applyMatrix4(component.matrix)
    }
    return vector
  }

  /**
   * Get object position
   * @abstract
   * @param  {number} pid - the picking id
   * @return {Vector3} the object position
   */
  _getPosition (pid: number) {
    return new Vector3()
  }

  /**
   * Get position for the given picking id
   * @param  {number} pid - the picking id
   * @param  {Object} instance - the instance that should be applied
   * @param  {Component} component - the component of the picked object
   * @return {Vector3} the position
   */
  getPosition (pid: number, instance: object, component: Component) {
    return this._applyTransformations(
      this._getPosition(pid), instance, component
    )
  }
}

/**
 * Shape picker class
 * @interface
 */
abstract class ShapePicker extends Picker {
  public get primitive() : Primitive { return new Primitive }

  /**
   * @param  {Shape} shape - shape object
   */
  constructor (readonly shape: Shape) {
    super([]);
  }

  get data () { return this.shape }
  get type () { return this.primitive.type }

  getObject (pid: number) {
    return this.primitive.objectFromShape(this.shape, this.getIndex(pid))
  }

  _getPosition (pid: number) {
    return this.primitive.positionFromShape(this.shape, this.getIndex(pid))
  }
}

//

class CylinderPicker extends ShapePicker {
  get primitive () { return new CylinderPrimitive }
}

class ArrowPicker extends ShapePicker {
  get primitive () { return new ArrowPrimitive }
}

class AtomPicker extends Picker {
  constructor (array: Array<any> | TypedArray, readonly structure: Structure) {
    super(array)
  }

  get type () { return 'atom' }
  get data () { return this.structure }

  getObject (pid: number) {
    return this.structure.getAtomProxy(this.getIndex(pid))
  }

  _getPosition (pid: number) {
    return this.getObject(pid).positionToVector3();
  }
}

class AxesPicker extends Picker {
  constructor (readonly axes: PrincipalAxes) {
    super([])
  }

  get type () { return 'axes' }
  get data () { return this.axes }

  getObject (/* pid */) {
    return {
      axes: this.axes
    }
  }

  _getPosition (/* pid */) {
    return this.axes.center.clone()
  }
}

class BondPicker extends Picker {
  public bondStore: BondStore;

  constructor (array: Array<any> | TypedArray, readonly structure: Structure, bondStore?: BondStore) {
    super(array)
    this.bondStore = bondStore || structure.bondStore;
  }

  get type () { return 'bond' }
  get data () { return this.structure }

  getObject (pid: number): BondProxy {
    const bp = this.structure.getBondProxy(this.getIndex(pid))
    bp.bondStore = this.bondStore
    return bp
  }

  _getPosition (pid: number) {
    const b = this.getObject(pid)
    return new Vector3()
      .copy(b.atom1.positionToVector3())
      .add(b.atom2.positionToVector3())
      .multiplyScalar(0.5)
  }
}

class ContactPicker extends Picker {
  constructor (array: Array<any> | TypedArray, readonly contacts: any, readonly structure: Structure) {
    super(array)
  }

  get type () { return 'contact' }
  get data () { return this.contacts }

  getObject (pid: number) {
    const idx = this.getIndex(pid)
    const { features, contactStore } = this.contacts
    const { centers, atomSets } = features
    const { x, y, z } = centers
    const { index1, index2, type } = contactStore
    const k = index1[idx]
    const l = index2[idx]
    return {
      center1: new Vector3(x[k], y[k], z[k]),
      center2: new Vector3(x[l], y[l], z[l]),
      atom1: this.structure.getAtomProxy(atomSets[k][0]),
      atom2: this.structure.getAtomProxy(atomSets[l][0]),
      type: contactTypeName(type[idx])
    }
  }

  _getPosition (pid: number) {
    const { center1, center2 } = this.getObject(pid)
    return new Vector3().addVectors(center1, center2).multiplyScalar(0.5)
  }
}

class ConePicker extends ShapePicker {
  get primitive () { return new ConePrimitive }
}

class ClashPicker extends Picker {
  constructor (array: Array<any> | TypedArray, readonly validation: any, readonly structure: Structure) {
    super(array)
  }

  get type () { return 'clash' }
  get data () { return this.validation }

  getObject (pid: number) {
    const val = this.validation
    const idx = this.getIndex(pid)
    return {
      validation: val,
      index: idx,
      clash: val.clashArray[ idx ]
    }
  }

  _getAtomProxyFromSele (sele: string): AtomProxy {
    const selection = new Selection(sele)
    const idx = this.structure.getAtomIndices(selection)![ 0 ]
    return this.structure.getAtomProxy(idx)
  }

  _getPosition (pid: number): Vector3 {
    const clash = this.getObject(pid).clash
    const ap1 = this._getAtomProxyFromSele(clash.sele1)
    const ap2 = this._getAtomProxyFromSele(clash.sele2)
    return new Vector3().copy(ap1.positionToVector3()).add(ap2.positionToVector3()).multiplyScalar(0.5)
  }
}

class DistancePicker extends BondPicker {
  get type () { return 'distance' }
}

class EllipsoidPicker extends ShapePicker {
  get primitive () { return new EllipsoidPrimitive }
}

class OctahedronPicker extends ShapePicker {
  get primitive () { return new OctahedronPrimitive }
}

class BoxPicker extends ShapePicker {
  get primitive () { return new BoxPrimitive }
}

class IgnorePicker extends Picker {
  get type () { return 'ignore' }
}

class MeshPicker extends ShapePicker {
  protected __position?: Vector3 = undefined;

  constructor (shape: Shape, readonly mesh: Mesh) {
    super(shape)
  }

  get type () { return 'mesh' }

  getObject (/* pid */) {
    const m = this.mesh
    return {
      shape: this.shape,
      name: m.name,
      serial: m.uuid,
    }
  }

  _getPosition (/* pid */) {
    if (!this.__position) {
      this.__position = calculateMeanVector3(this.mesh.position.toArray())
    }
    return this.__position
  }
}

class SpherePicker extends ShapePicker {
  get primitive () { return new SpherePrimitive }
}

class SurfacePicker extends Picker {
  constructor (array: Array<any> | TypedArray, readonly surface: any) {
    super(array)
    this.surface = surface
  }

  get type () { return 'surface' }
  get data () { return this.surface }

  getObject (pid: number) {
    return {
      surface: this.surface,
      index: this.getIndex(pid)
    }
  }

  _getPosition (/* pid */) {
    return this.surface.center.clone()
  }
}

class TetrahedronPicker extends ShapePicker {
  get primitive () { return new TetrahedronPrimitive }
}

class TorusPicker extends ShapePicker {
  get primitive () { return new TorusPrimitive }
}

class UnitcellPicker extends Picker {
  constructor (readonly unitcell: Unitcell, readonly structure: Structure) {
    super([])
  }

  get type () { return 'unitcell' }
  get data () { return this.unitcell }

  getObject (/* pid */) {
    return {
      unitcell: this.unitcell,
      structure: this.structure
    }
  }

  _getPosition (/* pid */) {
    return this.unitcell.getCenter(this.structure)
  }
}

class UnknownPicker extends Picker {
  get type () { return 'unknown' }
}

class VolumePicker extends Picker {
  constructor (array: Array<any> | TypedArray, readonly volume: any) {
    super(array)
  }

  get type () { return 'volume' }
  get data () { return this.volume }

  getObject (pid: number) {
    const vol = this.volume
    const idx = this.getIndex(pid)
    return {
      volume: vol,
      index: idx,
      value: vol.data[ idx ]
    }
  }

  _getPosition (pid: number) {
    const dp = this.volume.position
    const idx = this.getIndex(pid)
    return new Vector3(
      dp[ idx * 3 ],
      dp[ idx * 3 + 1 ],
      dp[ idx * 3 + 2 ]
    )
  }
}

class SlicePicker extends VolumePicker {
  get type () { return 'slice' }
}

class PointPicker extends ShapePicker {
  get primitive () { return new PointPrimitive }
}

class WidelinePicker extends ShapePicker {
  get primitive () { return new WidelinePrimitive }
}

PickerRegistry.add('arrow', ArrowPicker)
PickerRegistry.add('box', BoxPicker)
PickerRegistry.add('cone', ConePicker)
PickerRegistry.add('cylinder', CylinderPicker)
PickerRegistry.add('ellipsoid', EllipsoidPicker)
PickerRegistry.add('octahedron', OctahedronPicker)
PickerRegistry.add('sphere', SpherePicker)
PickerRegistry.add('tetrahedron', TetrahedronPicker)
PickerRegistry.add('torus', TorusPicker)
PickerRegistry.add('point', PointPicker)
PickerRegistry.add('wideline', WidelinePicker)

export {
  Picker,
  ShapePicker,
  ArrowPicker,
  AtomPicker,
  AxesPicker,
  BondPicker,
  BoxPicker,
  ConePicker,
  ContactPicker,
  CylinderPicker,
  ClashPicker,
  DistancePicker,
  EllipsoidPicker,
  IgnorePicker,
  OctahedronPicker,
  MeshPicker,
  SlicePicker,
  SpherePicker,
  SurfacePicker,
  TetrahedronPicker,
  TorusPicker,
  UnitcellPicker,
  UnknownPicker,
  VolumePicker,
  PointPicker,
  WidelinePicker
}
