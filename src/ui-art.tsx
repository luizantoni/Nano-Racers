import ReactEcs,{UiEntity} from '@dcl/sdk/react-ecs'
import {Color4} from '@dcl/sdk/math'
import {sprites} from './ui-sprites'

export type Art=keyof typeof sprites

// One alpha-blended sprite preserves the original curved outline. The padded
// shadow extends beyond the artwork without shrinking its touch target.
export function art(name:Art,tint=Color4.White()){
 const s=sprites[name]
 return <UiEntity uiTransform={{positionType:'absolute',position:{left:`${s.left}%`,top:`${s.top}%`},width:`${s.width}%`,height:`${s.height}%`,pointerFilter:'none'}} uiBackground={{texture:{src:s.src,filterMode:'bi-linear',wrapMode:'clamp'},textureMode:'stretch',color:tint}}/>
}
