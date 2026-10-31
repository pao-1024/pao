// 剖视总装 —— 沿 y=0 切掉 y>0 半边，检查内部
include <parts.scad>

module assy() {
    base_plate();
    barrel();
    color("orange") translate([fw_x, 0, fw_zc]) rotate([90, 0, 0]) flywheel();
    color("gold") drive_bracket();
    color("green") button_mount();
}

difference() {
    assy();
    translate([-50, 0, -50]) cube([220, 200, 220]);
}
