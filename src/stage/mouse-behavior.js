/**
 * @file Mouse Behavior
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */


import { RightMouseButton } from "../constants.js";
import { almostIdentity } from "../math/math-utils.js";


class MouseBehavior{

    constructor( stage/*, params*/ ){

        this.stage = stage;
        this.mouse = stage.mouseObserver;
        this.controls = stage.trackballControls;

        this.mouse.signals.scrolled.add( this.onScroll, this );
        this.mouse.signals.dragged.add( this.onDrag, this );

    }

    onScroll( delta ){

        if( this.mouse.shiftKey ){
            const sp = this.stage.getParameters();
            const focus = sp.clipNear * 2;
            const sign = Math.sign( delta );
            const step = sign * almostIdentity( ( 100 - focus ) / 10, 5, 0.2 );
            this.stage.setFocus( focus + step );
        }else{
            this.controls.zoom( delta );
        }

    }

    onDrag( x, y ){

        if( this.mouse.which === RightMouseButton ){
            this.controls.pan( x, y );
        }else{
            this.controls.rotate( x, y );
        }

    }

    dispose(){
        this.mouse.signals.scrolled.remove( this.onScroll, this );
        this.mouse.signals.dragged.remove( this.onDrag, this );
    }

}


export default MouseBehavior;
