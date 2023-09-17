## New Features

### (2023-09-13) New Character & Physics Enhancements:

- Incorporate 11 dynamic animations with new floating character, Uncle Pete
- Implement action and reaction forces on frictionless floating platforms:
  - Platforms now move opposite to the character's moving direction (Having less impact on havier platforms)
  - Character also applies drag force (friction) to the standing platform
  - Character's free fall height now impacts on platform reaction forces
  - Add extra downward force upon character jumps for more realistic physics
  
  [![screenshot](example/UnclePetePhysicsEnhance.png)](https://github.com/erdongchen-andrew/CharacterControl/tree/main/example)

### (2023-08-28) Character Animations:

- Incorporate 8 built-in dynamic animations (including 3 for jump actions)
- Flexibility to add and personalize additional animations
- Fine-tune slope angle's impact on jump direction (fully customizable)
- Tailor the rejection velocity for sudden changes in movement direction (fully customizable)

  [![screenshot](example/CharacterAnimation.png)](https://github.com/erdongchen-andrew/CharacterControl/tree/main/example)

### (2023-08-10) Camera Enhancement:

- Collision detection
- Zoom in/out capability
- Expanded movement range
- Improved tracking smoothness

### (2023-07-27) Character Auto Balance:

- Character tilts forward/backward while in motion
- Automatically returns to upright position after a hit or attack
- Stability customization: Users can fine-tune the balance sensitivity to match their gameplay style