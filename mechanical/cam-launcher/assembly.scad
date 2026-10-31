// 总装 —— 完全按卖家结构
include <parts.scad>

module tt_motor_ghost() {
    %translate([P_x - motor_w/2, motor_y0, base_t + 3])
        cube([motor_w, motor_l, motor_h]);
    // 输出轴（穿过圆板）
    %translate([P_x, motor_y0 - 16, P_z])
        rotate([-90, 0, 0])
            cylinder(d = motor_shaft_d, h = 18);
}

module assy() {
    base_plate();
    front_rail();
    barrel();
    color("skyblue")
        translate([feed_x, Y_L, 0]) magazine();
    motor_cradle();
    color("gold") band_anchor();
    color("orange") button_mount();

    // 销子套（紧贴圆板背面）
    color("tomato")
        translate([P_x, post_y0 + post_t, P_z])
            rotate([-90, 0, 0])
                pin_collar();

    // 圆板（在轴最外端）
    color("steelblue")
        translate([P_x, plate_y, P_z])
            striker_plate();

    tt_motor_ghost();
}

assy();
