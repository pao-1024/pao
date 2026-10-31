include <parts.scad>
$fn=96;
translate([24,0,0]) striker();    // 静止位：齿条后端对准 x=28
barrel();
base_plate();
color("gold") gearbox();
color("green") band_frame();
color("orange") button_mount();
// 齿轮组
color("silver") translate([88, layer1_y, 22]) rotate([90,0,0]) gear(z=z_small,m=gear_m,t=gear_t,bore=shaft_d+0.3);
color("silver") translate([58, layer1_y, 22]) rotate([90,0,0]) gear(z=z_big,m=gear_m,t=gear_t,bore=shaft_d+0.3);
color("silver") translate([58, layer2_y, 22]) rotate([90,0,0]) gear(z=z_small,m=gear_m,t=gear_t,bore=shaft_d+0.3);
color("silver") translate([28, layer2_y, 22]) rotate([90,0,0]) gear(z=z_big,m=gear_m,t=gear_t,bore=shaft_d+0.3);
color("red") translate([28, 3, 22]) rotate([90,0,0]) gear(z=z_small,m=gear_m,t=gear_t,bore=shaft_d+0.3);
