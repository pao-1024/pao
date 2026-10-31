// =====================================================================
//  总装图——仅用于检查装配关系，不用于打印
//  openscad -o assembly.png --viewall --autocenter assembly.scad
// =====================================================================

include <parts.scad>

show_ball = true;    // 画出弹丸位置，便于检查咬入角
show_flywheel = true;

module ball() {
    color("white")
        translate([fw_x, 0, base_t + ball_d / 2])
            sphere(d = ball_d, $fn = 48);
}

module assy() {
    base_plate();
    barrel();

    if (show_flywheel)
        color("orange")
            translate([fw_x, 0, fw_zc])
                rotate([90, 0, 0])
                    flywheel();

    color("gold")
        drive_bracket();

    color("green")
        button_mount();

    if (show_ball) ball();
}

assy();
