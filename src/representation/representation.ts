/**
 * @file Representation
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */

import { Color, Vector3, Matrix4 } from 'three'

import { Debug, Log, ColormakerRegistry, ExtensionFragDepth } from '../globals'
import { defaults } from '../utils'
import Queue from '../utils/queue.js'
import Counter from '../utils/counter.js'
import { BufferParameters } from '../buffer/buffer';
import Viewer from '../viewer/viewer';
import { ScaleParameters } from '../color/colormaker';

export type quality = 'auto' | 'low' | 'medium' | 'high';

export const RepresentationDefaultParameters = {
  lazy: false, // only build & update the representation when visible otherwise defer changes until set visible again
  colorScheme: '',
  'colorDomain.0': 0,
  'colorDomain.1': 1,
  quality: 'auto' as quality,
  visible: true,
}
export type RepresentationParameters = typeof RepresentationDefaultParameters & BufferParameters & ScaleParameters & { [k: string]: any };

/**
 * Representation object
 * @interface
 * @param {Object} object - the object to be represented
 * @param {Viewer} viewer - a viewer object
 * @param {RepresentationParameters} [params] - representation parameters
 */
abstract class Representation {
  /**
   * Counter that keeps track of tasks related to the creation of
   * the representation, including surface calculations.
   * @type {Counter}
   */
  public tasks: Counter;
  public lazy: boolean;
  public lazyProps = {
    build: false,
    bufferParams: {},
    what: {}
  };
  public quality: quality;
  public visible: boolean;
  
  private disposed: boolean = false;
  private bufferList: any[];
  private queue: Queue<any>;

  constructor (object, readonly viewer: Viewer, readonly parameters: Partial<RepresentationParameters> = {}) {

    if (this.parameters.colorScheme) {
      this.parameters.colorScheme.options = ColormakerRegistry.getSchemes()
    }
  }

  init (params: RepresentationParameters) {
    const p = params || {}

    this.parameters.clipNear = defaults(p.clipNear, 0)
    this.parameters.clipRadius = defaults(p.clipRadius, 0)
    this.parameters.clipCenter = defaults(p.clipCenter, new Vector3())
    this.parameters.flatShaded = defaults(p.flatShaded, false)
    this.parameters.side = defaults(p.side, 'double')
    this.parameters.opacity = defaults(p.opacity, 1.0)
    this.parameters.depthWrite = defaults(p.depthWrite, true)
    this.parameters.wireframe = defaults(p.wireframe, false)

    this.setColor(p.color, p)

    this.parameters.colorScheme = defaults(p.colorScheme, 'uniform')
    this.parameters.scale = defaults(p.scale, '')
    this.parameters.reverse = defaults(p.reverse, false)
    this.parameters.value = defaults(p.value, 0x909090)
    this.parameters.domain = defaults(p.domain, undefined)
    this.parameters.mode = defaults(p.mode, 'hcl')

    this.parameters.visible = defaults(p.visible, true)
    this.parameters.quality = defaults(p.quality, undefined)

    this.parameters.roughness = defaults(p.roughness, 0.4)
    this.parameters.metalness = defaults(p.metalness, 0.0)
    this.parameters.diffuse = defaults(p.diffuse, 0xffffff)

    this.parameters.diffuseInterior = defaults(p.diffuseInterior, false)
    this.parameters.useInteriorColor = defaults(p.useInteriorColor, false)
    this.parameters.interiorColor = defaults(p.interiorColor, 0x222222)
    this.parameters.interiorDarkening = defaults(p.interiorDarkening, 0)

    this.parameters.lazy = defaults(p.lazy, false)
    this.lazyProps = {
      build: false,
      bufferParams: {},
      what: {}
    }

    this.parameters.matrix = defaults(p.matrix, new Matrix4())

    this.parameters.disablePicking = defaults(p.disablePicking, false)

    // handle common parameters when applicable

    const tp = this.parameters

    if (tp.sphereDetail) {
      tp.sphereDetail = {
        type: 'integer', max: 3, min: 0, rebuild: 'impostor'
      }
    }
    if (tp.radialSegments) {
      tp.radialSegments = {
        type: 'integer', max: 25, min: 5, rebuild: 'impostor'
      }
    }
    if (tp.openEnded) {
      tp.openEnded = {
        type: 'boolean', rebuild: 'impostor', buffer: true
      }
    }
    if (tp.disableImpostor) {
      tp.disableImpostor = {
        type: 'boolean', rebuild: true
      }
    }

    if (p.quality === 'low') {
      if (tp.sphereDetail) this.sphereDetail = 0
      if (tp.radialSegments) this.radialSegments = 5
    } else if (p.quality === 'medium') {
      if (tp.sphereDetail) this.sphereDetail = 1
      if (tp.radialSegments) this.radialSegments = 10
    } else if (p.quality === 'high') {
      if (tp.sphereDetail) this.sphereDetail = 2
      if (tp.radialSegments) this.radialSegments = 20
    } else {
      if (tp.sphereDetail) {
        this.sphereDetail = defaults(p.sphereDetail, 1)
      }
      if (tp.radialSegments) {
        this.radialSegments = defaults(p.radialSegments, 10)
      }
    }

    if (tp.openEnded) {
      this.openEnded = defaults(p.openEnded, true)
    }

    if (tp.disableImpostor) {
      this.disableImpostor = defaults(p.disableImpostor, false)
    }
  }

  abstract get type (): string

  getColorParams (p: RepresentationParameters): ScaleParameters {
    return Object.assign({

      scheme: this.parameters.colorScheme,
      scale: this.parameters.scale,
      reverse: this.parameters.reverse,
      value: this.parameters.value,
      domain: this.parameters.domain,
      mode: this.parameters.mode,
    }, p)
  }

  getBufferParams (p: RepresentationParameters): BufferParameters {
    return Object.assign({

      clipNear: this.parameters.clipNear,
      clipRadius: this.parameters.clipRadius,
      clipCenter: this.parameters.clipCenter,
      flatShaded: this.parameters.flatShaded,
      opacity: this.parameters.opacity,
      depthWrite: this.parameters.depthWrite,
      side: this.parameters.side,
      wireframe: this.parameters.wireframe,

      roughness: this.parameters.roughness,
      metalness: this.parameters.metalness,
      diffuse: this.parameters.diffuse,

      diffuseInterior: this.parameters.diffuseInterior,
      useInteriorColor: this.parameters.useInteriorColor,
      interiorColor: this.parameters.interiorColor,
      interiorDarkening: this.parameters.interiorDarkening,

      matrix: this.parameters.matrix,

      disablePicking: this.parameters.disablePicking

    }, p)
  }

  setColor (value?: string | number | Color, p: RepresentationParameters) {
    const types = Object.keys(ColormakerRegistry.getSchemes())

    if (typeof value === 'string' && types.includes(value.toLowerCase())) {
      if (p) {
        p.colorScheme = value
      } else {
        this.setParameters({ colorScheme: value })
      }
    } else if (value !== undefined) {
      value = new Color(value).getHex()
      if (p) {
        p.colorScheme = 'uniform'
        p.colorValue = value
      } else {
        this.setParameters({
          colorScheme: 'uniform', colorValue: value
        })
      }
    }

    return this
  }

  // TODO
  // get prepare(){ return false; }

  create () {
    // this.bufferList.length = 0;
  }

  update (what?: any) {
    this.build(what);
  }

  build (updateWhat?: any) {
    if (this.parameters.lazy && (!this.visible || !this.parameters.opacity)) {
      this.lazyProps.build = true
      return
    }

    if (!this.prepare) {
      this.tasks.increment()
      this.make()
      return
    }

    // don't let tasks accumulate
    if (this.queue.length() > 0) {
      this.tasks.change(1 - this.queue.length())
      this.queue.kill()
    } else {
      this.tasks.increment()
    }

    this.queue.push(updateWhat || false)
  }

  make (updateWhat?: any, callback?: (...args: any[]) => any) {
    if (Debug) Log.time('Representation.make ' + this.type)

    const _make = () => {
      if (updateWhat) {
        this.update(updateWhat)
        this.viewer.requestRender()
        this.tasks.decrement()
        if (callback) callback()
      } else {
        this.clear()
        this.create()
        if (!this.disposed) {
          if (Debug) Log.time('Representation.attach ' + this.type)
          this.attach(() => {
            if (Debug) Log.timeEnd('Representation.attach ' + this.type)
            this.tasks.decrement()
            if (callback) callback()
          })
        }
      }

      if (Debug) Log.timeEnd('Representation.make ' + this.type)
    }

    if (this.prepare) {
      this.prepare(_make)
    } else {
      _make()
    }
  }

  attach (callback: () => void) {
    this.setVisibility(this.visible)

    callback()
  }

  /**
   * Set the visibility of the representation
   * @param {Boolean} value - visibility flag
   * @param {Boolean} [noRenderRequest] - whether or not to request a re-render from the viewer
   * @return {Representation} this object
   */
  setVisibility (value: boolean, noRenderRequest: boolean) {
    this.visible = value

    if (this.visible && this.parameters.opacity) {
      const lazyProps = this.lazyProps
      const bufferParams = lazyProps.bufferParams
      const what = lazyProps.what

      if (lazyProps.build) {
        lazyProps.build = false
        this.build()
        return
      } else if (Object.keys(bufferParams).length || Object.keys(what).length) {
        lazyProps.bufferParams = {}
        lazyProps.what = {}
        this.updateParameters(bufferParams, what)
      }
    }

    this.bufferList.forEach(function (buffer) {
      buffer.setVisibility(value)
    })

    if (!noRenderRequest) this.viewer.requestRender()

    return this
  }

  /**
   * Set the visibility of the representation
   * @param {RepresentationParameters} params - parameters object
   * @param {Object} [what] - buffer data attributes to be updated,
   *                        note that this needs to be implemented in the
   *                        derived classes. Generally it allows more
   *                        fine-grained control over updating than
   *                        forcing a rebuild.
   * @param {Boolean} what.position - update position data
   * @param {Boolean} what.color - update color data
   * @param {Boolean} [rebuild] - whether or not to rebuild the representation
   * @return {Representation} this object
   */
  setParameters (params: RepresentationParameters, what = {}, rebuild = false) {
    const p = params || {}
    const tp = this.parameters
    const bufferParams = {}

    if (!this.parameters.opacity && p.opacity !== undefined) {
      if (this.lazyProps.build) {
        this.lazyProps.build = false
        rebuild = true
      } else {
        Object.assign(bufferParams, this.lazyProps.bufferParams)
        Object.assign(what, this.lazyProps.what)
        this.lazyProps.bufferParams = {}
        this.lazyProps.what = {}
      }
    }

    this.setColor(p.color, p)

    for (let name in p) {
      if (p[ name ] === undefined) continue
      if (tp[ name ] === undefined) continue

      if (tp[ name ].int) p[ name ] = parseInt(p[ name ])
      if (tp[ name ].float) p[ name ] = parseFloat(p[ name ])

      // no value change
      if (p[ name ] === this[ name ] && (
        !p[ name ].equals || p[ name ].equals(this[ name ])
      )) continue

      if (this[ name ] && this[ name ].copy && p[ name ].copy) {
        this[ name ].copy(p[ name ])
      } else if (this[ name ] && this[ name ].set) {
        this[ name ].set(p[ name ])
      } else {
        this[ name ] = p[ name ]
      }

      // buffer param
      if (tp[ name ].buffer) {
        if (tp[ name ].buffer === true) {
          bufferParams[ name ] = p[ name ]
        } else {
          bufferParams[ tp[ name ].buffer ] = p[ name ]
        }
      }

      // mark for update
      if (tp[ name ].update) {
        what[ tp[ name ].update ] = true
      }

      // mark for rebuild
      if (tp[ name ].rebuild &&
          !(tp[ name ].rebuild === 'impostor' &&
            ExtensionFragDepth && !this.disableImpostor)
      ) {
        rebuild = true
      }
    }

    //

    if (rebuild) {
      this.build()
    } else {
      this.updateParameters(bufferParams, what)
    }

    return this
  }

  updateParameters (bufferParams = {}, what: any) {
    if (this.lazy && (!this.visible || !this.opacity) && bufferParams.opacity === undefined) {
      Object.assign(this.lazyProps.bufferParams, bufferParams)
      Object.assign(this.lazyProps.what, what)
      return
    }

    this.bufferList.forEach(function (buffer) {
      buffer.setParameters(bufferParams)
    })

    if (Object.keys(what).length) {
      this.update(what) // update buffer attribute
    }

    this.viewer.requestRender()
  }

  getParameters () {
    const params = {
      lazy: this.lazy,
      visible: this.visible,
      quality: this.quality
    }

    Object.keys(this.parameters).forEach(name => {
      if (this.parameters[ name ] !== null) {
        params[ name ] = this[ name ]
      }
    })

    return params
  }

  clear () {
    this.bufferList.forEach(buffer => {
      this.viewer.remove(buffer)
      buffer.dispose()
    })
    this.bufferList.length = 0

    this.viewer.requestRender()
  }

  dispose () {
    this.disposed = true
    this.queue.kill()
    this.tasks.dispose()
    this.clear()
  }
}

export default Representation
