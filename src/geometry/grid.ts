/**
 * @file Grid
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */

class Grid {
  protected data: any;

  constructor(readonly length: number, readonly width: number, readonly height: number, readonly DataCtor: any = Int32Array, readonly elemSize: number = 1) {
    this.data = new DataCtor(length * width * height * elemSize);
  }

  public toArray (x: number, y: number, z: number, array: any[], offset: number) {
    const i = this.index(x, y, z);

    if (array === undefined) array = [];
    if (offset === undefined) offset = 0;

    for (let j = 0; j < this.elemSize; ++j) {
      array[ offset + j ] = this.data[ i + j ];
    }
  }

  public fromArray (x: number, y: number, z: number, array: any[], offset: number) {
    const i = this.index(x, y, z);

    if (offset === undefined) offset = 0;

    for (let j = 0; j < this.elemSize; ++j) {
      this.data[ i + j ] = array[ offset + j ];
    }
  }

  public copy (grid: Grid) {
    this.data.set(grid.data);
  }

  public clone() {
    return new Grid(
      this.length, this.width, this.height, this.DataCtor, this.elemSize
    ).copy(this);
  }

  public set(x: number, y: number, z: number) {
    const i = this.index(x, y, z);

    for (let j = 0; j < this.elemSize; ++j) {
      this.data[ i + j ] = arguments[ 3 + j ];
    }
  }

  public index(x: number, y: number, z: number) {
    return ((((x * this.width) + y) * this.height) + z) * this.elemSize;
  }
}

export default Grid
