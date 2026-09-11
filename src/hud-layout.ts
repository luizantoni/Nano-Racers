// Layout in SDK virtual pixels; phone landscape reserves more space for the road.
export function measureHud(width:number,height:number,mobile:boolean){
 const w=Math.max(1,width),h=Math.max(1,height)
 const scale=Math.min(w/(mobile?1600:1920),h/(mobile?720:1080))
 const density=w/h>1.5?.65:.85
 const unit=mobile||w<900?Math.max(1,Math.min(4,density/scale)):1
 const controlHeight=Math.min(88*unit,(w/scale*.84*.4-10*unit)/2)
 return {unit,scale,compact:h>w||w/h<1.5,portrait:h>w,controlHeight}
}
