// =====================================================================
//  剖视图辅助文件 —— 仅用于生成 preview/06-section.png，不作打印件
//
//  用法：
//    1. 先导出 barrel.stl（本目录下）
//    2. openscad -o section.png --viewall --autocenter \
//         --imgsize=1100,800 --camera=0,0,0,55,0,25,0 barrel-section.scad
//
//  沿 y=0 切掉 y>0 半边，露出弹道内腔与落弹孔。
// =====================================================================

difference() {
    import("barrel.stl", convexity = 10);
    translate([-500, 0, -500]) cube([1000, 500, 1000]);
}
